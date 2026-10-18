import { useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, Check, ChevronDown, CircleUserRound, LayoutDashboard, Pencil, ReceiptText, Zap } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/useAuth';
import type { MeldUser } from '../auth/context';
import { getFirebaseAuth } from '../lib/firebase';
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

function AccountPage({ user, onNameSave, onPasswordReset }: {
  user: MeldUser;
  onNameSave: (fullName: string) => Promise<void>;
  onPasswordReset: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onNameSave(fullName.trim());
      setEditing(false);
      setNotice('Your profile name has been updated.');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Meld could not update your name. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink() {
    setResetBusy(true);
    setError('');
    setNotice('');
    try {
      await onPasswordReset();
      setNotice('If this address can receive a reset, a secure link is on its way. Check your inbox and spam folder.');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Meld could not send a reset link. Try again.');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <>
      <div className="app-page-heading"><div><p className="eyebrow">ACCOUNT</p><h1>Your details</h1><p>Manage the profile details and sign-in security connected to your Meld account.</p></div></div>
      <section className="account-panel" aria-labelledby="profile-title">
        <div className="account-panel-heading"><div><p className="eyebrow">PROFILE</p><h2 id="profile-title">Personal details</h2></div>
          {!editing && <button className="button button--secondary account-edit-button" type="button" onClick={() => { setFullName(user.fullName); setEditing(true); setNotice(''); setError(''); }}><Pencil size={16} aria-hidden="true" />Edit name</button>}
        </div>
        {editing ? (
          <form className="account-edit-form" onSubmit={(event) => void saveName(event)}>
            <label className="field" htmlFor="profile-name"><span>Full name</span><input id="profile-name" autoComplete="name" minLength={2} maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
            <div className="account-edit-actions"><button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button className="button button--secondary" type="button" onClick={() => { setFullName(user.fullName); setEditing(false); setError(''); }}>Cancel</button></div>
          </form>
        ) : (
          <dl className="account-details" aria-label="Profile details">
            <div><dt>Name</dt><dd>{user.fullName}</dd></div>
            <div><dt>Email</dt><dd>{user.email}<small>Email is managed by Firebase sign-in and cannot be changed here yet.</small></dd></div>
            <div><dt>Email verification</dt><dd className="verified-state"><Check size={16} aria-hidden="true" />Verified</dd></div>
          </dl>
        )}
      </section>
      <section className="account-panel account-security-panel" aria-labelledby="security-title">
        <div className="account-panel-heading"><div><p className="eyebrow">SIGN-IN & SECURITY</p><h2 id="security-title">Password</h2></div></div>
        <p>Send a secure password-reset link to <strong>{user.email}</strong>. The link is handled by Firebase and Meld will never ask you to share your password.</p>
        <button className="button button--secondary" type="button" onClick={() => void sendResetLink()} disabled={resetBusy}>{resetBusy ? 'Sending link…' : 'Send password reset link'}</button>
      </section>
      {(error || notice) && <div className="account-feedback" aria-live="polite">{error ? <p className="form-message" role="alert">{error}</p> : <p className="form-message form-message--success" role="status">{notice}</p>}</div>}
      <section className="account-panel account-history-panel" aria-labelledby="account-activity-title">
        <div className="account-panel-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2 id="account-activity-title">Sign-up and sign-in records</h2></div></div>
        <p>Meld records account creation, verified access, successful sign-ins, sign-outs and profile-name changes in a restricted security log to help investigate account issues. This is not payment activity; bill payments appear under Activity.</p>
      </section>
    </>
  );
}

export function ProductShell() {
  const { user, signOut, updateFullName } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const userMenuRef = useRef<HTMLDetailsElement>(null);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { navigate('/sign-in', { replace: true }); }
  }

  async function handlePasswordReset() {
    const auth = getFirebaseAuth();
    if (!auth || !user?.email) throw new Error('Meld could not identify the signed-in email. Sign out and sign in again.');
    await sendPasswordResetEmail(auth, user.email, { url: `${window.location.origin}/sign-in?reset=complete` });
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
          <details className="app-user-menu" ref={userMenuRef}>
            <summary aria-label={`Signed in as ${user.fullName}. Open account menu`}><CircleUserRound aria-hidden="true" /><span>{user.fullName.split(' ')[0]}</span><ChevronDown className="app-user-menu-chevron" aria-hidden="true" /></summary>
            <div className="app-user-menu-panel">
              <p className="app-user-menu-label">SIGNED IN AS</p><strong>{user.fullName}</strong><span className="app-user-menu-email">{user.email}</span>
              <Link to="/app/account" onClick={() => { if (userMenuRef.current) userMenuRef.current.open = false; }}>Manage account</Link>
              <button type="button" onClick={() => { if (userMenuRef.current) userMenuRef.current.open = false; void handleSignOut(); }} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          </details>
        </div>
      </header>
      <main className="app-main" id="app-main">
        {isPay ? <PayPage /> : isActivity ? <ActivityPage /> : isAccount ? <AccountPage user={user} onNameSave={async (fullName) => { await updateFullName(fullName); }} onPasswordReset={handlePasswordReset} /> : <Overview name={user.fullName} />}
      </main>
    </div>
  );
}
