import { useState, type FormEvent } from 'react';
import { ShieldCheck, LoaderCircle, LockKeyhole } from 'lucide-react';
import { api } from '../api';
import type { User } from '../../shared/types';
import { initials } from '../lib/format';
import { Button, Message, Field } from '../components/ui';
export function Profile({
  user,
  forced = false,
  onChanged,
}: {
  user: User;
  forced?: boolean;
  onChanged: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('newPassword') !== f.get('confirm')) {
      setError(new Error('Nová hesla se neshodují.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password', {
        method: 'POST',
        body: {
          currentPassword: f.get('currentPassword'),
          newPassword: f.get('newPassword'),
        },
      });
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">VÁŠ PŘÍSTUP</span>
          <h1>{forced ? 'Nastavte své heslo' : 'Můj profil'}</h1>
          <p>
            {forced
              ? 'Dočasné heslo nahraďte vlastním. Potom se znovu přihlaste.'
              : 'Základní údaje a zabezpečení vašeho účtu.'}
          </p>
        </div>
      </div>
      <section className="panel profile-panel">
        <div className="profile-summary">
          <span className="avatar large">{initials(user.display_name)}</span>
          <div>
            <h2>{user.display_name}</h2>
            <p>
              @{user.username} · {user.role === 'dispatcher' ? 'Dispečer' : 'Řidič'}
            </p>
          </div>
          <ShieldCheck size={25} />
        </div>
        <form onSubmit={submit}>
          <h3>{forced ? 'První přihlášení' : 'Změna hesla'}</h3>
          <Message error={error} />
          <Field label="Současné heslo *">
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="Nové heslo *" hint="Alespoň 12 znaků. Změna odhlásí všechna vaše zařízení.">
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Nové heslo znovu *">
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <LockKeyhole size={17} />}
            Uložit nové heslo
          </Button>
        </form>
      </section>
    </>
  );
}
