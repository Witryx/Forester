import { useState, useEffect, type FormEvent } from 'react';
import {
  Plus,
  ShieldCheck,
  UserRound,
  Search,
  LoaderCircle,
  LockKeyhole,
  UsersRound,
  Check,
} from 'lucide-react';
import { api, ApiError } from '../api';
import type { Bootstrap, User } from '../../shared/types';
import { initials } from '../lib/format';
import { Button, Message, Field, Dialog } from '../components/ui';
export function Accounts({ data, refresh }: { data: Bootstrap; refresh: () => Promise<unknown> }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [create, setCreate] = useState(false);
  const [reset, setReset] = useState<User | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('driver');
  const [employeeChoice, setEmployeeChoice] = useState('new');
  const creatingEmployee = create && role === 'driver' && employeeChoice === 'new';
  const [formError, setFormError] = useState<unknown>();
  async function load() {
    try {
      setUsers(await api<User[]>('/users'));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const cb = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', cb);
    return () => window.removeEventListener('beforeunload', cb);
  }, [dirty]);
  const close = () => {
    setEditing(null);
    setCreate(false);
    setReset(null);
    setDirty(false);
    setFormError(null);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const f = new FormData(e.currentTarget);
    try {
      if (reset)
        await api(`/users/${reset.id}/reset-password`, {
          method: 'POST',
          body: { password: f.get('password'), version: reset.version },
        });
      else if (editing)
        await api(`/users/${editing.id}`, {
          method: 'PATCH',
          body: {
            username: f.get('username'),
            displayName: f.get('displayName'),
            active: f.get('active') === 'on',
            role: f.get('role'),
            employeeId: f.get('employeeId') || null,
            version: editing.version,
          },
        });
      else
        await api('/users', {
          method: 'POST',
          body: {
            username: f.get('username'),
            displayName: creatingEmployee
              ? `${String(f.get('firstName')).trim()} ${String(f.get('lastName')).trim()}`
              : f.get('displayName'),
            password: f.get('password'),
            role: f.get('role'),
            employeeId: role === 'driver' && !creatingEmployee ? employeeChoice : null,
            ...(creatingEmployee && {
              newEmployee: { firstName: f.get('firstName'), lastName: f.get('lastName') },
            }),
          },
        });
      close();
      await load();
      await refresh();
      window.dispatchEvent(
        new CustomEvent('forester:toast', {
          detail: reset
            ? 'Dočasné heslo je nastavené. Staré přihlášení je zneplatněné.'
            : 'Účet je uložený.',
        }),
      );
    } catch (err) {
      setFormError(err);
      if (err instanceof ApiError && err.status === 409) await load();
    } finally {
      setBusy(false);
    }
  }
  const filtered = users.filter((u) =>
    `${u.username} ${u.display_name}`
      .toLocaleLowerCase('cs')
      .includes(query.toLocaleLowerCase('cs')),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">SPRÁVNÝ PŘÍSTUP PRO KAŽDÉHO</span>
          <h1>Účty a oprávnění</h1>
          <p>Váš tým má přístup jen k tomu, co patří k jeho práci.</p>
        </div>
        <Button
          onClick={() => {
            setRole('driver');
            setEmployeeChoice('new');
            setCreate(true);
          }}
        >
          <Plus size={18} /> Nový účet
        </Button>
      </div>
      <div className="role-cards">
        <div className="panel role-card">
          <span className="stat-icon green">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h3>Dispečer</h3>
            <p>Správa uživatelských účtů a oprávnění.</p>
          </div>
          <strong>{users.filter((u) => u.role === 'dispatcher' && u.active).length}</strong>
        </div>
        <div className="panel role-card">
          <span className="stat-icon blue">
            <UserRound size={21} />
          </span>
          <div>
            <h3>Řidič</h3>
            <p>Přístup do řidičské části aplikace.</p>
          </div>
          <strong>{users.filter((u) => u.role === 'driver' && u.active).length}</strong>
        </div>
      </div>
      <Message error={error} />
      {!!error && (
        <Button secondary onClick={load}>
          Načíst znovu
        </Button>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            Členové týmu <span className="count-pill">{users.length}</span>
          </h2>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Hledat účet"
              placeholder="Jméno nebo přihlášení…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <div className="empty-state compact">
            <LoaderCircle className="spin" />
          </div>
        ) : (
          filtered.map((u) => (
            <div className="account-row" key={u.id}>
              <span className="mini-avatar">{initials(u.display_name)}</span>
              <div className="account-person">
                <strong>
                  {u.display_name} {u.id === data.user.id && <small className="you-tag">Vy</small>}
                </strong>
                <small>@{u.username}</small>
              </div>
              <span className="role-tag">{u.role === 'dispatcher' ? 'Dispečer' : 'Řidič'}</span>
              <span className={`badge ${u.active ? 'planned' : 'cancelled'}`}>
                <span />
                {u.active ? 'Aktivní' : 'Neaktivní'}
              </span>
              <div className="account-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(u);
                    setRole(u.role);
                    setEmployeeChoice(u.employee_id || '');
                  }}
                >
                  Upravit
                </button>
                <button
                  className="icon-button"
                  aria-label={`Resetovat heslo ${u.username}`}
                  title="Reset hesla"
                  onClick={() => setReset(u)}
                >
                  <LockKeyhole size={17} />
                </button>
              </div>
            </div>
          ))
        )}
        {!loading && !filtered.length && (
          <div className="empty-state compact">
            <UsersRound size={30} />
            <h3>{users.length ? 'Žádný účet neodpovídá hledání' : 'Zatím žádné účty'}</h3>
          </div>
        )}
        <div className="table-footer">
          <ShieldCheck size={15} />
          <span>Deaktivace ihned ukončí všechna přihlášení účtu. Historie zůstane zachovaná.</span>
        </div>
      </section>
      {(create || editing || reset) && (
        <Dialog
          title={reset ? 'Obnovit přístup' : editing ? 'Upravit účet' : 'Nový člen týmu'}
          description={
            reset
              ? `Nastavte dočasné heslo pro ${reset.display_name}. Při přihlášení si ho musí změnit.`
              : editing
                ? 'Uložení změn účtu ukončí jeho dosavadní přihlášení.'
                : 'Nový uživatel si při prvním přihlášení změní dočasné heslo.'
          }
          onClose={close}
          dirty={dirty}
        >
          <form
            key={editing ? `${editing.id}:${editing.version}` : 'create'}
            onSubmit={save}
            onChange={() => setDirty(true)}
          >
            <Message error={formError} />
            {reset ? (
              <Field
                label="Nové dočasné heslo *"
                hint="Alespoň 12 znaků. Předání hesla vyřešte přímo s kolegou."
              >
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </Field>
            ) : (
              <>
                <Field label="Role *">
                  <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="driver">Řidič</option>
                    <option value="dispatcher">Dispečer</option>
                  </select>
                </Field>
                {role === 'driver' && (
                  <Field
                    label="Zaměstnanec *"
                    hint={
                      creatingEmployee
                        ? 'Profil a účet se vytvoří společně. Evidenční kód přidělíme automaticky.'
                        : 'Vyberte člověka, kterému účet patří. Každý zaměstnanec může mít jeden účet.'
                    }
                  >
                    <select
                      name="employeeId"
                      required
                      value={employeeChoice}
                      onChange={(e) => setEmployeeChoice(e.target.value)}
                    >
                      <option value="" disabled>
                        Vyberte zaměstnance
                      </option>
                      {create && <option value="new">Vytvořit nového zaměstnance</option>}
                      {data.employees
                        .filter(
                          (emp) =>
                            emp.active &&
                            !users.some((u) => u.employee_id === emp.id && u.id !== editing?.id),
                        )
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} · {emp.code}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {creatingEmployee && (
                  <div className="form-grid">
                    <Field label="Jméno *">
                      <input name="firstName" required maxLength={80} autoComplete="given-name" />
                    </Field>
                    <Field label="Příjmení *">
                      <input name="lastName" required maxLength={80} autoComplete="family-name" />
                    </Field>
                  </div>
                )}
                <div className={creatingEmployee ? undefined : 'form-grid'}>
                  {!creatingEmployee && (
                    <Field label="Celé jméno *">
                      <input
                        name="displayName"
                        required
                        minLength={2}
                        maxLength={80}
                        defaultValue={editing?.display_name || ''}
                      />
                    </Field>
                  )}
                  <Field label="Uživatelské jméno *">
                    <input
                      name="username"
                      required
                      pattern="[a-z0-9._\-]{3,40}"
                      minLength={3}
                      maxLength={40}
                      autoComplete="off"
                      defaultValue={editing?.username || ''}
                    />
                  </Field>
                </div>
                {!editing && (
                  <Field
                    label="Dočasné heslo *"
                    hint="Alespoň 12 znaků. Při prvním přihlášení bude nutná změna."
                  >
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </Field>
                )}
                {editing && (
                  <label className="checkbox-line">
                    <input name="active" type="checkbox" defaultChecked={!!editing.active} /> Účet
                    je aktivní
                  </label>
                )}
              </>
            )}
            <div className="modal-footer">
              <Button
                secondary
                onClick={() => {
                  if (!dirty || window.confirm('Zahodit neuložené změny?')) close();
                }}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
                Uložit {reset ? 'heslo' : 'účet'}
              </Button>
            </div>
            {editing && formError instanceof ApiError && formError.status === 409 && (
              <Button
                secondary
                onClick={() => {
                  const current = users.find((u) => u.id === editing.id);
                  if (current) {
                    setEditing(current);
                    setRole(current.role);
                    setEmployeeChoice(current.employee_id || '');
                    setFormError(null);
                    setDirty(false);
                  }
                }}
              >
                Načíst aktuální verzi účtu
              </Button>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
