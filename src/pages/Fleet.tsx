import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { Button, Dialog, Field, Message } from '../components/ui';
import { initials } from '../lib/format';
import type {
  Assignment,
  Availability,
  Driver,
  Fleet,
  FleetTrailer,
  FleetVehicle,
} from '../../shared/types';

export type FleetScope = 'drivers' | 'vehicles' | 'trailers';
type Item = Driver | FleetVehicle | FleetTrailer;
type History = Assignment & {
  first_name: string;
  last_name: string;
  plate: string;
  trailer_plate: string | null;
};
type ItemDetail = Item & { photos?: string[]; history: History[] };
const labels: Record<Availability, string> = {
  available: 'K dispozici',
  assigned: 'Přiřazeno',
  busy: 'Na přepravě',
  vacation: 'Dovolená',
  sick: 'Nemoc',
  off_duty: 'Volno',
  inactive: 'Neaktivní',
  service: 'V servisu',
  out_of_service: 'Mimo provoz',
};
const scopeInfo = {
  drivers: { title: 'Řidiči', singular: 'řidiče', add: 'Nový řidič', path: '/firma/ridici' },
  vehicles: { title: 'Tahače', singular: 'tahače', add: 'Nový tahač', path: '/firma/tahace' },
  trailers: { title: 'Návěsy', singular: 'návěsu', add: 'Nový návěs', path: '/firma/navesy' },
};
const kindNames: Record<string, string> = {
  timber: 'Lesní technika',
  universal: 'Univerzální',
  other: 'Ostatní',
};
const number = (value: number | null, suffix = '') =>
  value === null ? 'Neuvedeno' : `${new Intl.NumberFormat('cs-CZ').format(value)}${suffix}`;
const date = (value: number) =>
  new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(value);
const isDriver = (item: Item): item is Driver => 'first_name' in item;
const itemName = (item: Item) =>
  isDriver(item) ? `${item.first_name} ${item.last_name}` : item.plate;
const toast = (detail: string) =>
  window.dispatchEvent(new CustomEvent('forester:toast', { detail }));
const readId = () => window.location.pathname.split('/')[3] || null;
function State({ value }: { value: Availability }) {
  return (
    <span className={`fleet-state state-${value}`}>
      <i />
      {labels[value]}
    </span>
  );
}
function useDirty(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const listener = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
}

export function FleetPage({
  scope,
  refresh,
}: {
  scope: FleetScope;
  refresh: () => Promise<unknown>;
}) {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(readId);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailError, setDetailError] = useState<unknown>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<{ item: ItemDetail | null } | null>(null);
  const [assigning, setAssigning] = useState<Driver | null>(null);
  const [opening, setOpening] = useState(false);
  const generation = useRef(0);
  const info = scopeInfo[scope];
  async function load() {
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = await api<Fleet>('/fleet');
      if (current !== generation.current) return;
      setFleet(next);
      setError(null);
    } catch (err) {
      if (current === generation.current) setError(err);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const pop = () => setSelectedId(readId());
    window.addEventListener('popstate', pop);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30000);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener('popstate', pop);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setDetail((previous) => (previous?.id === selectedId ? previous : null));
    setDetailError(null);
    if (selectedId)
      api<ItemDetail>(`/${scope}/${encodeURIComponent(selectedId)}`)
        .then((next) => {
          if (!cancelled) setDetail(next);
        })
        .catch((err) => {
          if (!cancelled) setDetailError(err);
        });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fleet?.fetchedAt, scope]);
  function select(id: string | null) {
    window.history.pushState(null, '', info.path + (id ? `/${id}` : ''));
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  }
  async function edit(item: Item) {
    setOpening(true);
    try {
      setEditor({ item: await api<ItemDetail>(`/${scope}/${item.id}`) });
    } catch (err) {
      setError(err);
    } finally {
      setOpening(false);
    }
  }
  async function assign(driver: Driver) {
    setOpening(true);
    try {
      const next = await api<Fleet>('/fleet');
      setFleet(next);
      setAssigning(next.drivers.find((item) => item.id === driver.id)!);
    } catch (err) {
      setError(err);
    } finally {
      setOpening(false);
    }
  }
  async function saved() {
    await load();
    await refresh();
  }
  const rows = fleet?.[scope] || [];
  const matches = rows.filter((row) => {
    const assignment = fleet?.assignments.find(
      (a) =>
        a[
          scope === 'drivers' ? 'employee_id' : scope === 'vehicles' ? 'vehicle_id' : 'trailer_id'
        ] === row.id,
    );
    const vehicle = fleet?.vehicles.find((v) => v.id === assignment?.vehicle_id);
    const trailer = fleet?.trailers.find((v) => v.id === assignment?.trailer_id);
    const driver = fleet?.drivers.find((v) => v.id === assignment?.employee_id);
    const haystack = `${itemName(row)} ${isDriver(row) ? `${row.code} ${row.phone} ${row.email || ''}` : `${row.manufacturer} ${row.model}`} ${vehicle?.plate || ''} ${trailer?.plate || ''} ${driver ? itemName(driver) : ''}`;
    return (
      haystack.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs').trim()) &&
      (filter === 'all' || (filter === 'unassigned' ? !assignment : row.availability === filter))
    );
  });
  const current =
    detail &&
    fleet?.assignments.find(
      (a) =>
        a[
          scope === 'drivers' ? 'employee_id' : scope === 'vehicles' ? 'vehicle_id' : 'trailer_id'
        ] === detail.id,
    );
  const ownDriver =
    detail &&
    (isDriver(detail) ? detail : fleet?.drivers.find((d) => d.id === current?.employee_id));
  return (
    <div className="fleet-screen">
      <div className="page-heading fleet-heading">
        <div>
          <h1>{selectedId ? `Detail ${info.singular}` : info.title}</h1>
          <p>
            {scope === 'drivers'
              ? 'Kontakty, dostupnost a soupravy vašeho týmu.'
              : 'Technické údaje, provozní stav a aktuální přiřazení.'}
          </p>
        </div>
        {!selectedId && (
          <Button onClick={() => setEditor({ item: null })}>
            <Plus size={18} />
            {info.add}
          </Button>
        )}
      </div>
      <Message error={error} />
      {selectedId ? (
        <>
          <button className="text-button fleet-back" onClick={() => select(null)}>
            <ArrowLeft size={16} /> Zpět na{' '}
            {scope === 'drivers' ? 'řidiče' : scope === 'vehicles' ? 'tahače' : 'návěsy'}
          </button>
          <Message error={detailError} />
          {detailError ? (
            <Button secondary onClick={load}>
              Načíst znovu
            </Button>
          ) : !detail || !fleet ? (
            <Loading />
          ) : (
            <>
              <section className="panel fleet-identity">
                {isDriver(detail) ? (
                  <span className="avatar large">{initials(itemName(detail))}</span>
                ) : 'photo_count' in detail && detail.photo_count > 0 ? (
                  <img
                    className="fleet-detail-thumb"
                    src={`/api/vehicles/${detail.id}/photos/0?v=${detail.version}`}
                    alt={`${detail.manufacturer} ${detail.model}`}
                  />
                ) : (
                  <Truck size={32} aria-hidden="true" />
                )}
                <div>
                  <h2>{itemName(detail)}</h2>
                  <p>{isDriver(detail) ? detail.code : `${detail.manufacturer} ${detail.model}`}</p>
                  <State value={detail.availability} />
                </div>
                <Button secondary disabled={opening} onClick={() => edit(detail)}>
                  <Pencil size={16} /> Upravit
                </Button>
              </section>
              <div className="fleet-detail-grid">
                <section className="panel fleet-section">
                  <h2>{isDriver(detail) ? 'Kontaktní údaje' : 'Technické údaje'}</h2>
                  <dl className="fleet-facts">
                    {isDriver(detail) ? (
                      <>
                        <Fact label="Telefon">
                          {detail.phone ? (
                            <a href={`tel:${detail.phone.replace(/\s/g, '')}`}>{detail.phone}</a>
                          ) : (
                            'Neuvedeno'
                          )}
                        </Fact>
                        <Fact label="E-mail">
                          {detail.email ? (
                            <a href={`mailto:${detail.email}`}>{detail.email}</a>
                          ) : (
                            'Neuvedeno'
                          )}
                        </Fact>
                        <Fact label="Evidenční kód">{detail.code}</Fact>
                      </>
                    ) : (
                      <>
                        <Fact label="Výrobce">{detail.manufacturer}</Fact>
                        <Fact label="Model">{detail.model}</Fact>
                        <Fact label="Rok výroby">{number(detail.year)}</Fact>
                        <Fact label="Nosnost">{number(detail.capacity_kg, ' kg')}</Fact>
                        <Fact label="Typ">{kindNames[detail.kind] || detail.kind}</Fact>
                        {'vin' in detail && (
                          <>
                            <Fact label="VIN">{detail.vin || 'Neuvedeno'}</Fact>
                            <Fact label="Tachometr">{number(detail.odometer_km, ' km')}</Fact>
                            <Fact label="Hydraulická ruka">{detail.crane ? 'Ano' : 'Ne'}</Fact>
                          </>
                        )}
                      </>
                    )}
                    <Fact label="Evidovaný stav">
                      {detail.status === 'available'
                        ? isDriver(detail)
                          ? 'Aktivní'
                          : 'Provozuschopné'
                        : labels[detail.status]}
                    </Fact>
                  </dl>
                  <h3>Poznámka</h3>
                  <p className="fleet-note">{detail.note || 'Bez poznámky.'}</p>
                </section>
                <section className="panel fleet-section">
                  <div className="fleet-section-heading">
                    <h2>Aktuální souprava</h2>
                    {ownDriver && (
                      <button
                        disabled={opening}
                        className="text-button"
                        onClick={() => assign(ownDriver)}
                      >
                        <Link2 size={15} /> Změnit
                      </button>
                    )}
                  </div>
                  <Rig
                    fleet={fleet}
                    assignment={current || undefined}
                    onSelect={(nextScope, id) => {
                      window.history.pushState(null, '', `${scopeInfo[nextScope].path}/${id}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                      window.scrollTo({ top: 0 });
                    }}
                  />
                  {!ownDriver && (
                    <p className="fleet-note">
                      Techniku přiřadíte v detailu řidiče v části Aktuální souprava.
                    </p>
                  )}
                </section>
              </div>
              {'photos' in detail && !!detail.photos?.length && (
                <section className="panel fleet-section">
                  <h2>Fotografie tahače</h2>
                  <div className="fleet-gallery">
                    {detail.photos.map((_photo, index) => (
                      <a
                        key={index}
                        href={`/api/vehicles/${detail.id}/photos/${index}?v=${detail.version}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={`/api/vehicles/${detail.id}/photos/${index}?v=${detail.version}`}
                          alt={`Tahač ${itemName(detail)} – fotografie ${index + 1}`}
                        />
                      </a>
                    ))}
                  </div>
                </section>
              )}
              <section className="panel fleet-section">
                <h2>Historie přiřazení</h2>
                <p className="fleet-note">Posledních 20 přiřazení · čas v Praze</p>
                {detail.history.length ? (
                  <div className="fleet-history">
                    {detail.history.map((a) => (
                      <div key={a.id}>
                        <strong>
                          {a.first_name} {a.last_name}
                        </strong>
                        <span>
                          {a.plate}
                          {a.trailer_plate && ` / ${a.trailer_plate}`}
                        </span>
                        <small>
                          {date(a.starts_at)} → {a.ends_at ? date(a.ends_at) : 'Dosud'}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fleet-note">Zatím žádná přiřazení.</p>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <section className="panel fleet-list-panel">
            <div className="fleet-toolbar">
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label={`Hledat ${info.singular}`}
                  placeholder={
                    scope === 'drivers' ? 'Jméno, kontakt nebo SPZ…' : 'SPZ, výrobce nebo řidič…'
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="fleet-filter">
                <span>Dostupnost</span>
                <select
                  aria-label="Filtrovat dostupnost"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Všechny stavy</option>
                  <option value="unassigned">Bez přiřazení</option>
                  {(scope === 'drivers'
                    ? ['available', 'assigned', 'busy', 'vacation', 'sick', 'off_duty', 'inactive']
                    : ['available', 'assigned', 'busy', 'service', 'out_of_service', 'inactive']
                  ).map((state) => (
                    <option value={state} key={state}>
                      {labels[state as Availability]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                aria-label="Obnovit data"
                title="Obnovit data"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw size={17} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <div className="fleet-list-caption">
              <span>
                {matches.length}{' '}
                {scope === 'drivers' ? 'řidičů' : scope === 'vehicles' ? 'tahačů' : 'návěsů'}
                {rows.length !== matches.length ? ` z ${rows.length}` : ''}
              </span>
              <span>
                Stav k{' '}
                {fleet
                  ? new Intl.DateTimeFormat('cs-CZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Prague',
                    }).format(fleet.fetchedAt)
                  : '—'}
              </span>
            </div>
            {!fleet && loading ? (
              <Loading />
            ) : !fleet && error ? (
              <div className="fleet-empty">
                <p>Data se nepodařilo načíst.</p>
                <Button secondary onClick={load}>
                  Zkusit znovu
                </Button>
              </div>
            ) : !matches.length ? (
              <div className="fleet-empty">
                <UsersRound size={28} />
                <h2>
                  {rows.length
                    ? 'Nic neodpovídá filtrům'
                    : scope === 'drivers'
                      ? 'Zatím žádní řidiči'
                      : scope === 'vehicles'
                        ? 'Zatím žádné tahače'
                        : 'Zatím žádné návěsy'}
                </h2>
                <p>
                  {rows.length
                    ? 'Změňte hledání nebo dostupnost.'
                    : 'Začněte přidáním prvního záznamu.'}
                </p>
                {rows.length > 0 && (
                  <Button
                    secondary
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Zrušit filtry
                  </Button>
                )}
              </div>
            ) : scope === 'drivers' ? (
              <div className="fleet-driver-list">
                <div className="fleet-driver-header">
                  <span>Řidič a kontakt</span>
                  <span>Dostupnost</span>
                  <span>Aktuální souprava</span>
                  <span>Akce</span>
                </div>
                {(matches as Driver[]).map((driver) => {
                  const a = fleet?.assignments.find((item) => item.employee_id === driver.id);
                  return (
                    <div className="fleet-driver-row" key={driver.id}>
                      <div className="fleet-person">
                        <span className="mini-avatar">{initials(itemName(driver))}</span>
                        <div>
                          <button className="fleet-name" onClick={() => select(driver.id)}>
                            {itemName(driver)}
                          </button>
                          <small>
                            {driver.code} · {driver.phone || 'Telefon neuveden'}
                          </small>
                        </div>
                      </div>
                      <State value={driver.availability} />
                      <div className="fleet-rig-summary">
                        {a ? (
                          <>
                            <strong>
                              {fleet?.vehicles.find((v) => v.id === a.vehicle_id)?.plate}
                            </strong>
                            <small>
                              {a.trailer_id
                                ? `Návěs ${fleet?.trailers.find((t) => t.id === a.trailer_id)?.plate}`
                                : 'Bez návěsu'}
                            </small>
                          </>
                        ) : (
                          <span className="muted">Bez přiřazení</span>
                        )}
                      </div>
                      <div className="fleet-row-actions">
                        <button className="text-button" onClick={() => select(driver.id)}>
                          Detail <ArrowRight size={14} />
                        </button>
                        <button
                          className="icon-button"
                          title="Přiřadit soupravu"
                          aria-label={`Přiřadit soupravu: ${itemName(driver)}`}
                          disabled={opening}
                          onClick={() => assign(driver)}
                        >
                          <Link2 size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="fleet-equipment-grid">
                {(matches as (FleetVehicle | FleetTrailer)[]).map((item) => {
                  const a = fleet?.assignments.find(
                    (a) => a[scope === 'vehicles' ? 'vehicle_id' : 'trailer_id'] === item.id,
                  );
                  const owner = fleet?.drivers.find((driver) => driver.id === a?.employee_id);
                  return (
                    <article className="fleet-equipment-card" key={item.id}>
                      {'photo_count' in item && item.photo_count > 0 && (
                        <button
                          className="fleet-photo-button"
                          aria-label={`Detail tahače ${item.plate}`}
                          onClick={() => select(item.id)}
                        >
                          <img
                            src={`/api/vehicles/${item.id}/photos/0?v=${item.version}`}
                            alt={`${item.manufacturer} ${item.model}`}
                            loading="lazy"
                          />
                        </button>
                      )}
                      <div className="fleet-card-heading">
                        <h2>
                          <button className="fleet-name" onClick={() => select(item.id)}>
                            {item.plate}
                          </button>
                        </h2>
                        <State value={item.availability} />
                      </div>
                      <p className="fleet-model">
                        {item.manufacturer} {item.model}
                      </p>
                      <dl className="fleet-card-facts">
                        <Fact label="Nosnost">{number(item.capacity_kg, ' kg')}</Fact>
                        <Fact label="Rok">{number(item.year)}</Fact>
                      </dl>
                      <div className="fleet-card-owner">
                        <span className="muted">Řidič</span>
                        <strong>{owner ? itemName(owner) : 'Bez přiřazení'}</strong>
                      </div>
                      <div className="fleet-card-actions">
                        <button className="text-button" onClick={() => select(item.id)}>
                          Otevřít detail <ArrowRight size={15} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={opening}
                          aria-label={`Upravit ${item.plate}`}
                          onClick={() => edit(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <p className="fleet-explanation">
            K dispozici = dostupné a bez přiřazení. Přiřazeno = součást stálé soupravy. Na přepravě
            = právě rezervováno pro jízdu.
          </p>
        </>
      )}
      {editor && (
        <FleetEditor
          scope={scope}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {assigning && fleet && (
        <AssignmentEditor
          driver={assigning}
          fleet={fleet}
          onClose={() => setAssigning(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="fleet-empty" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>Načítání…</p>
    </div>
  );
}
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function Rig({
  fleet,
  assignment,
  onSelect,
}: {
  fleet: Fleet;
  assignment?: Assignment;
  onSelect: (scope: FleetScope, id: string) => void;
}) {
  if (!assignment) return <p className="fleet-note">Zatím bez přiřazené soupravy.</p>;
  const parts: [FleetScope, Item | undefined, string][] = [
    ['drivers', fleet.drivers.find((d) => d.id === assignment.employee_id), 'Řidič'],
    ['vehicles', fleet.vehicles.find((d) => d.id === assignment.vehicle_id), 'Tahač'],
    ['trailers', fleet.trailers.find((d) => d.id === assignment.trailer_id), 'Návěs'],
  ];
  return (
    <>
      <div className="fleet-rig">
        {parts.map(([scope, item, label]) => (
          <div key={scope}>
            <span>{label}</span>
            {item ? (
              <>
                <button className="fleet-name" onClick={() => onSelect(scope, item.id)}>
                  {itemName(item)}
                </button>
                <small>{isDriver(item) ? item.code : `${item.manufacturer} ${item.model}`}</small>
                <State value={item.availability} />
              </>
            ) : (
              <strong>Bez návěsu</strong>
            )}
          </div>
        ))}
      </div>
      <p className="fleet-note">Přiřazeno od {date(assignment.starts_at)}</p>
    </>
  );
}

function FleetEditor({
  scope,
  item,
  onClose,
  onSaved,
}: {
  scope: FleetScope;
  item: ItemDetail | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const [photos, setPhotos] = useState<string[]>(item?.photos || []);
  useDirty(dirty);
  const driver = item && isDriver(item) ? item : null;
  const equipment = item && !isDriver(item) ? item : null;
  const vehicle = scope === 'vehicles' ? (item as FleetVehicle | null) : null;
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      if (photos.length + files.length > 4) throw new Error('Lze přidat nejvýše 4 fotografie.');
      const next: string[] = [];
      for (const file of Array.from(files)) next.push(await preparePhoto(file));
      setPhotos((current) => [...current, ...next]);
      setDirty(true);
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const numeric = (key: string) => (form.get(key) === '' ? null : Number(form.get(key)));
    const body =
      scope === 'drivers'
        ? {
            firstName: form.get('firstName'),
            lastName: form.get('lastName'),
            phone: form.get('phone'),
            email: form.get('email'),
            status: form.get('status'),
            note: form.get('note'),
          }
        : {
            plate: form.get('plate'),
            manufacturer: form.get('manufacturer'),
            model: form.get('model'),
            year: numeric('year'),
            capacityKg: numeric('capacityKg'),
            kind: form.get('kind'),
            status: form.get('status'),
            note: form.get('note'),
            ...(scope === 'vehicles' && {
              vin: form.get('vin'),
              odometerKm: numeric('odometerKm'),
              crane: form.get('crane') === 'on',
              photos,
            }),
          };
    try {
      await api(`/${scope}${item ? `/${item.id}` : ''}`, {
        method: item ? 'PATCH' : 'POST',
        body: { ...body, ...(item && { version: item.version }) },
      });
      setDirty(false);
      onClose();
      toast('Záznam je uložený.');
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const cancel = () => {
    if (!busy && !uploading && (!dirty || window.confirm('Zahodit neuložené změny?'))) onClose();
  };
  return (
    <Dialog
      title={item ? `Upravit ${scopeInfo[scope].singular}` : scopeInfo[scope].add}
      description={
        scope === 'drivers'
          ? 'Profil řidiče lze vést i bez přihlašovacího účtu.'
          : 'Údaje zůstanou uložené ve vozovém parku.'
      }
      dirty={dirty}
      onClose={() => {
        if (!busy && !uploading) onClose();
      }}
    >
      <form className="fleet-form" onSubmit={save} onChange={() => setDirty(true)}>
        <Message error={error} />
        <fieldset disabled={busy || uploading}>
          {scope === 'drivers' ? (
            <>
              <div className="form-grid">
                <Field label="Jméno *">
                  <input
                    name="firstName"
                    required
                    maxLength={80}
                    autoComplete="given-name"
                    defaultValue={driver?.first_name}
                  />
                </Field>
                <Field label="Příjmení *">
                  <input
                    name="lastName"
                    required
                    maxLength={80}
                    autoComplete="family-name"
                    defaultValue={driver?.last_name}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Telefon">
                  <input
                    name="phone"
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    defaultValue={driver?.phone}
                  />
                </Field>
                <Field label="E-mail">
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    defaultValue={driver?.email || ''}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Registrační značka *">
                <input
                  name="plate"
                  required
                  minLength={3}
                  maxLength={20}
                  autoCapitalize="characters"
                  defaultValue={equipment?.plate}
                />
              </Field>
              <div className="form-grid">
                <Field label="Výrobce *">
                  <input
                    name="manufacturer"
                    required
                    maxLength={80}
                    defaultValue={equipment?.manufacturer}
                  />
                </Field>
                <Field label="Model *">
                  <input name="model" required maxLength={80} defaultValue={equipment?.model} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Rok výroby">
                  <input
                    name="year"
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    defaultValue={equipment?.year ?? ''}
                  />
                </Field>
                <Field label="Nosnost (kg)">
                  <input
                    name="capacityKg"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200000}
                    defaultValue={equipment?.capacity_kg ?? ''}
                  />
                </Field>
              </div>
              <Field label="Typ techniky">
                <select name="kind" defaultValue={equipment?.kind || 'timber'}>
                  {Object.entries(kindNames).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {scope === 'vehicles' && (
                <>
                  <div className="form-grid">
                    <Field label="VIN" hint="17 znaků; nepoužívá I, O a Q.">
                      <input
                        name="vin"
                        maxLength={17}
                        pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
                        autoCapitalize="characters"
                        defaultValue={vehicle?.vin || ''}
                      />
                    </Field>
                    <Field label="Tachometr (km)">
                      <input
                        name="odometerKm"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10000000}
                        defaultValue={vehicle?.odometer_km ?? ''}
                      />
                    </Field>
                  </div>
                  <label className="checkbox-line">
                    <input name="crane" type="checkbox" defaultChecked={!!vehicle?.crane} />{' '}
                    Hydraulická ruka
                  </label>
                </>
              )}
            </>
          )}
          <Field
            label={scope === 'drivers' ? 'Stav řidiče *' : 'Provozní stav *'}
            hint="Dostupnost se navíc odvozuje z přiřazení, přeprav a evidovaných odstávek či nepřítomností."
          >
            <select name="status" defaultValue={item?.status || 'available'}>
              {(scope === 'drivers'
                ? ['available', 'vacation', 'sick', 'off_duty', 'inactive']
                : ['available', 'service', 'out_of_service', 'inactive']
              ).map((state) => (
                <option key={state} value={state}>
                  {state === 'available'
                    ? scope === 'drivers'
                      ? 'Aktivní'
                      : 'Provozuschopné'
                    : labels[state as Availability]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Poznámka">
            <textarea name="note" rows={3} maxLength={2000} defaultValue={item?.note} />
          </Field>
          {scope === 'drivers' && (
            <p className="fleet-note">
              Neaktivní stav ukončí přiřazení a deaktivuje řidičský účet. Po opětovné aktivaci
              profilu zapnete účet ve správě účtů.
            </p>
          )}
          {scope !== 'drivers' && (
            <p className="fleet-note">
              Neaktivní stav ukončí přiřazení soupravy. Servis a stav mimo provoz přiřazení
              zachovají.
            </p>
          )}
          {scope === 'vehicles' && (
            <div className="fleet-photo-editor">
              <h3>Fotografie tahače</h3>
              <p className="fleet-note">
                Nejvýše 4 fotografie JPG, PNG nebo WebP. Obrázky před uložením zmenšíme do 500 kB.
              </p>
              <div className="fleet-photo-previews">
                {photos.map((src, index) => (
                  <div key={index}>
                    <img src={src} alt={`Fotografie ${index + 1}`} />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Odebrat fotografii ${index + 1}`}
                      onClick={() => {
                        setPhotos((current) => current.filter((_, i) => i !== index));
                        setDirty(true);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Field label="Přidat fotografie">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={photos.length >= 4}
                  onChange={(event) => {
                    upload(event.target.files);
                    event.target.value = '';
                  }}
                />
              </Field>
            </div>
          )}
        </fieldset>
        {uploading && (
          <p role="status" className="fleet-note">
            <Upload size={16} /> Zpracování fotografií…
          </p>
        )}
        <div className="modal-footer">
          <Button secondary onClick={cancel} disabled={busy || uploading}>
            Zrušit
          </Button>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? 'Ukládání…' : 'Uložit'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function AssignmentEditor({
  driver,
  fleet,
  onClose,
  onSaved,
}: {
  driver: Driver;
  fleet: Fleet;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const current = fleet.assignments.find((a) => a.employee_id === driver.id);
  const [vehicleId, setVehicleId] = useState(current?.vehicle_id || '');
  const [trailerId, setTrailerId] = useState(current?.trailer_id || '');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const dirty =
    vehicleId !== (current?.vehicle_id || '') || trailerId !== (current?.trailer_id || '');
  useDirty(dirty);
  function unavailable(item: FleetVehicle | FleetTrailer, key: 'vehicle_id' | 'trailer_id') {
    return (
      item.status !== 'available' ||
      !item.active ||
      !['available', 'assigned', 'busy'].includes(item.availability) ||
      fleet.assignments.some((a) => a[key] === item.id && a.employee_id !== driver.id)
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/drivers/${driver.id}/assignment`, {
        method: 'PUT',
        body: {
          vehicleId: vehicleId || null,
          trailerId: (vehicleId && trailerId) || null,
          version: driver.version,
        },
      });
      onClose();
      toast(vehicleId ? 'Souprava je přiřazená.' : 'Přiřazení je ukončené.');
      await onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new Error('Přiřazení se nepodařilo uložit. Zkuste to znovu.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Přiřadit soupravu"
      description={`${itemName(driver)} · ${driver.code}`}
      dirty={dirty}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="fleet-form" onSubmit={save}>
        <Message error={error} />
        <fieldset disabled={busy}>
          <Field
            label="Tahač"
            hint="Obsazená a nedostupná technika se zobrazuje pro přehled, nelze ji nově vybrat."
          >
            <select
              value={vehicleId}
              onChange={(event) => {
                setVehicleId(event.target.value);
                if (!event.target.value) setTrailerId('');
              }}
            >
              <option value="">Bez tahače – ukončit přiřazení</option>
              {fleet.vehicles.map((item) => (
                <option key={item.id} value={item.id} disabled={unavailable(item, 'vehicle_id')}>
                  {item.plate} · {item.manufacturer} {item.model}
                  {unavailable(item, 'vehicle_id') ? ' · Nedostupné' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Návěs">
            <select
              value={trailerId}
              disabled={!vehicleId}
              onChange={(event) => setTrailerId(event.target.value)}
            >
              <option value="">Bez návěsu</option>
              {fleet.trailers.map((item) => (
                <option key={item.id} value={item.id} disabled={unavailable(item, 'trailer_id')}>
                  {item.plate} · {item.manufacturer} {item.model}
                  {unavailable(item, 'trailer_id') ? ' · Nedostupné' : ''}
                </option>
              ))}
            </select>
          </Field>
          <p className="fleet-note">
            Změna platí od uložení. Předchozí přiřazení zůstane v historii. Stálá souprava nemění
            již naplánované přepravy.
          </p>
        </fieldset>
        <div className="modal-footer">
          <Button
            secondary
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm('Zahodit neuložené změny?')) onClose();
            }}
          >
            Zrušit
          </Button>
          <Button type="submit" disabled={busy || !dirty}>
            {busy ? 'Ukládání…' : 'Uložit přiřazení'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15000000)
    throw new Error('Vyberte fotografii JPG, PNG nebo WebP do 15 MB.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Fotografii se nepodařilo otevřít. Vyberte jiný soubor.');
  });
  try {
    const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Prohlížeč nepodporuje zpracování fotografií.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5, 0.35]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if ((data.length - 23) * 0.75 <= 500000) return data;
    }
    throw new Error('Fotografii se nepodařilo zmenšit do 500 kB. Vyberte menší obrázek.');
  } finally {
    bitmap.close();
  }
}
