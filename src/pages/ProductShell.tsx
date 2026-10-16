import { useState } from 'react';
import { Activity, ArrowRight, CircleUserRound, LayoutDashboard, LogOut, ReceiptText, Zap } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/useAuth';
import { PayPage } from './PayPage';
import { ActivityPage } from './ActivityPage';

const destinations = [
  { to: '/app', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/app/pay', label: 'Pay', Icon: Zap },
  { to: '/app/activity', label: 'Activity', Icon: Activity },
  { to: '/app/account', label: 'Account', Icon: CircleUserRound },
];

function Overview({ name }: { name: string }) {
  return (
    <>
      <div className="app-page-heading">
        <div><p className="eyebrow">YOUR MELD SPACE</p><h1>Welcome, {name.split(' ')[0]}.</h1><p>See your payment records and continue a bill payment through Meld’s provider sandbox.</p></div>
      </div>
      <section className="app-primary-panel" aria-labelledby="overview-pay-title">
        <div><p className="eyebrow">NEXT STEP</p><h2 id="overview-pay-title">Pay an everyday bill</h2><p>Explore the sandbox flow for electricity, airtime, mobile data and cable TV.</p></div>
        <Link className="button button--primary" to="/app/pay">View services <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
      <section className="app-empty-panel app-overview-note" aria-labelledby="activity-preview-title">
        <span className="empty-icon"><ReceiptText aria-hidden="true" /></span>
        <h2 id="activity-preview-title">No payment history yet</h2>
        <p>There are no transactions to show. Meld will only add a record after a payment has been processed and its outcome is confirmed.</p>
      </section>
    </>
  );
}

function AccountPage({ fullName, email, onSignOut, busy }: { fullName: string; email: string; onSignOut: () => void; busy: boolean }) {
  return (
    <>
      <div className="app-page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>Your details</h1><p>Account information connected to your current sign-in.</p></div></div>
      <section className="account-details" aria-label="Account details">
        <div><span>Name</span><strong>{fullName}</strong></div>
        <div><span>Email</span><strong>{email}</strong></div>
        <div><span>Email verification</span><strong className="verified-state">Verified</strong></div>
      </section>
      <button className="button button--secondary signout-button" type="button" onClick={onSignOut} disabled={busy}><LogOut size={17} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}</button>
    </>
  );
}

export function ProductShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { navigate('/sign-in', { replace: true }); }
  }

  if (!user) return null;
  const isPay = location.pathname.startsWith('/app/pay');
  const isActivity = location.pathname.startsWith('/app/activity');
  const isAccount = location.pathname.startsWith('/app/account');

  return (
    <div className="app-page">
      <a className="skip-link" href="#app-main">Skip to content</a>
      <header className="app-topbar">
        <div className="container app-topbar-inner">
          <Link to="/app" aria-label="Meld overview"><Brand /></Link>
          <nav className="app-nav" aria-label="Your account">
            {destinations.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <Link className="app-account-link" to="/app/account" aria-label={`Account for ${user.fullName}`}><CircleUserRound aria-hidden="true" /><span>{user.fullName.split(' ')[0]}</span></Link>
        </div>
      </header>
      <main className="app-main" id="app-main">
        {isPay ? <PayPage /> : isActivity ? <ActivityPage /> : isAccount ? <AccountPage fullName={user.fullName} email={user.email} onSignOut={() => void handleSignOut()} busy={signingOut} /> : <Overview name={user.fullName} />}
      </main>
    </div>
  );
}
