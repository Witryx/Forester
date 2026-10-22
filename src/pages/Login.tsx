import { useState, type FormEvent } from 'react';
import {
  Trees,
  Truck,
  Sun,
  Moon,
  LoaderCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
} from 'lucide-react';
import { api } from '../api';
import { Button, Message, Field, ForestArt } from '../components/ui';
export function Login({
  onLogin,
  theme,
  toggleTheme,
}: {
  onLogin: () => Promise<void>;
  theme: string;
  toggleTheme: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      await api('/auth/login', {
        method: 'POST',
        body: {
          username: data.get('username'),
          password: data.get('password'),
        },
      });
      await onLogin();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Trees size={27} />
          </span>
          forester<span className="brand-dot">.</span>
        </div>
        <div className="login-copy">
          <span className="eyebrow">MÉNĚ STAROSTÍ. VÍCE PŘEHLEDU.</span>
          <h1>
            Každá jízda.
            <br />
            Pod kontrolou.
          </h1>
          <p>
            Pracovní prostor pro lidi, kteří drží
            <br className="desktop-only" /> přepravu dřeva v pohybu.
          </p>
          <div className="login-points">
            <span>
              <Truck size={18} /> Od lesa až na pilu
            </span>
          </div>
        </div>
        <div className="login-forest">
          <ForestArt />
        </div>
        <div className="login-foot">
          <span>PŘEPRAVA DŘEVA & LESNÍ TĚŽBA</span>
          <span>EST. 2026</span>
        </div>
      </section>
      <section className="login-form-side">
        <button
          className="icon-button login-theme"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
        <form className="login-form" onSubmit={submit}>
          <span className="section-kicker">VÍTEJTE ZPÁTKY</span>
          <h2>Přihlášení do Foresteru</h2>
          <Message error={error} />
          <Field label="Uživatelské jméno">
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              placeholder="např. dispecer"
              autoFocus
            />
          </Field>
          <Field label="Heslo">
            <div className="password-wrap">
              <input
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Vaše heslo"
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Skrýt heslo' : 'Zobrazit heslo'}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}Přihlásit se{' '}
            <ArrowRight size={17} />
          </Button>
          <div className="login-help">
            <LockKeyhole size={15} />
            <span>
              Přístup zakládá váš dispečer.
              <br />
              Pro obnovení hesla se obraťte přímo na něj.
            </span>
          </div>
        </form>
        <div className="login-small">Forester © 2026</div>
      </section>
    </main>
  );
}
