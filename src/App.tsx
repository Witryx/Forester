import { useEffect, useState } from 'react';
import {
  Check,
  ChevronRight,
  FolderLock,
  Leaf,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  Settings2,
  Sun,
  Trees,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError, setCsrf } from './api';
import type { Bootstrap } from '../shared/types';
import { initials } from './lib/format';
import { paths, pageFromPath, type Destination, type Page } from './navigation';
import { Button, Message } from './components/ui';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Accounts } from './pages/Accounts';
import { Profile } from './pages/Profile';
function NavItem({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
    >
      <Icon size={19} />
      <span>{label}</span>
      {selected && <i />}
    </button>
  );
}
export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [page, setPage] = useState<Page>(pageFromPath);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('forester.theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  async function refresh() {
    try {
      const next = await api<Bootstrap>('/bootstrap');
      setCsrf(next.csrfToken);
      setData(next);
      setError(null);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setData(null);
        setCsrf('');
      } else setError(err);
    } finally {
      setLoading(false);
    }
  }
  function navigate(next: Destination) {
    window.history.pushState(null, '', paths[next]);
    setPage(next);
    setMobile(false);
  }
  useEffect(() => {
    refresh();
    const expired = () => {
      setData(null);
      setCsrf('');
      setToast('Přihlášení vypršelo. Přihlaste se znovu.');
    };
    const pop = () => setPage(pageFromPath());
    const notification = (e: Event) => setToast((e as CustomEvent<string>).detail);
    window.addEventListener('forester:expired', expired);
    window.addEventListener('popstate', pop);
    window.addEventListener('forester:toast', notification);
    return () => {
      window.removeEventListener('forester:expired', expired);
      window.removeEventListener('popstate', pop);
      window.removeEventListener('forester:toast', notification);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('forester.theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [data?.user.id]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setData(null);
      setCsrf('');
      navigate('overview');
    } catch (err) {
      setError(err);
    }
  }
  if (loading)
    return (
      <div className="initial-loading">
        <Trees size={38} />
        <p>Načítáme váš pracovní prostor…</p>
        <LoaderCircle className="spin" size={20} />
      </div>
    );
  if (!data)
    return (
      <>
        <Login
          onLogin={async () => {
            const next = await refresh();
            if (next) navigate('overview');
          }}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        {!!error && (
          <div className="login-server-error">
            <Message error={error} />
            <Button secondary onClick={() => refresh()}>
              Zkusit znovu
            </Button>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  if (data.user.must_change_password)
    return (
      <div className="forced-password">
        <div className="brand">
          <Trees />
          forester.
        </div>
        <Profile
          user={data.user}
          forced
          onChanged={() => {
            setData(null);
            setCsrf('');
            setToast('Heslo je změněné. Přihlaste se novým heslem.');
          }}
        />
        <Button secondary onClick={logout}>
          Odhlásit se
        </Button>
      </div>
    );
  const driver = data.user.role === 'driver';
  const forbidden = driver && page === 'users';
  const titles: Record<Page, string> = {
    overview: 'Úvod',
    users: 'Správa účtů',
    'not-found': 'Stránka nenalezena',
  };
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Zavřít navigaci"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href={paths.overview}
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
        >
          <span className="brand-mark">
            <Trees size={26} />
          </span>
          forester<span className="brand-dot">.</span>
        </a>
        <div className="workspace-badge">
          <span className="workspace-symbol">
            <Leaf size={18} />
          </span>
          <div>
            Lesní doprava<small>Pracovní prostor</small>
          </div>
        </div>
        <div className="nav-label">{driver ? 'ŘIDIČ' : 'DISPEČER'}</div>
        <nav aria-label="Hlavní navigace">
          <NavItem
            icon={LayoutDashboard}
            label="Úvod"
            selected={page === 'overview'}
            onClick={() => navigate('overview')}
          />
          {!driver && (
            <NavItem
              icon={Settings2}
              label="Účty a oprávnění"
              selected={page === 'users'}
              onClick={() => navigate('users')}
            />
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-person">
            <div className="person-button">
              <span className="avatar">{initials(data.user.display_name)}</span>
              <span>
                {data.user.display_name}
                <small>{driver ? 'Řidič' : 'Dispečer'}</small>
              </span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Odhlásit se"
              title="Odhlásit se"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Otevřít navigaci"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="desktop-only">Pracovní prostor</span>
            <ChevronRight size={14} className="desktop-only" />
            <strong>{titles[page]}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
              title="Změnit režim"
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="top-avatar" aria-label={data.user.display_name}>
              {initials(data.user.display_name)}
            </div>
          </div>
        </header>
        <main className="content">
          <Message error={error} />
          {!!error && (
            <Button secondary onClick={() => refresh()}>
              Načíst znovu
            </Button>
          )}
          {forbidden || page === 'not-found' ? (
            <div className="empty-state">
              <FolderLock size={40} />
              <h1>{forbidden ? 'Tady potřebujete jiná oprávnění' : 'Stránka nebyla nalezena'}</h1>
              <p>
                {forbidden
                  ? 'Tato část není pro vaši roli dostupná.'
                  : 'Tato adresa není dostupná.'}
              </p>
              <Button onClick={() => navigate('overview')}>Zpět na úvod</Button>
            </div>
          ) : (
            <>
              {page === 'overview' && (
                <Home user={data.user} onAccounts={() => navigate('users')} />
              )}
              {page === 'users' && <Accounts data={data} refresh={refresh} />}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Trees size={14} /> Forester
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button className="icon-button" onClick={() => setToast('')} aria-label="Zavřít oznámení">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
