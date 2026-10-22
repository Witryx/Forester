import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { User } from '../../shared/types';
import { initials } from '../lib/format';
import { Button } from '../components/ui';

export function Home({ user, onAccounts }: { user: User; onAccounts: () => void }) {
  const driver = user.role === 'driver';
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">FORESTER</span>
          <h1>Vítejte, {user.display_name.split(' ')[0]}.</h1>
          <p>Jste přihlášeni jako {driver ? 'řidič' : 'dispečer'}.</p>
        </div>
      </div>
      <section className="panel profile-panel">
        <div className="profile-summary">
          <span className="avatar large">{initials(user.display_name)}</span>
          <div>
            <h2>{user.display_name}</h2>
            <p>
              @{user.username} · {driver ? 'Řidič' : 'Dispečer'}
            </p>
          </div>
          <ShieldCheck size={25} />
        </div>
        <div className="home-panel-content">
          <p className="muted small">
            {driver
              ? 'Správu vašeho účtu zajišťuje dispečer.'
              : 'V účtech a oprávněních můžete spravovat přístupy svého týmu.'}
          </p>
          {!driver && (
            <Button onClick={onAccounts}>
              Správa účtů <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </section>
    </>
  );
}
