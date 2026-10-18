import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, reload, signInWithEmailAndPassword, updateProfile, type User } from 'firebase/auth';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Brand } from '../components/Brand';
import { useAuth } from '../auth/useAuth';
import { getFirebaseAuth, requireFirebaseAuth } from '../lib/firebase';
import { ApiError, apiRequest } from '../lib/api';
import { recordAuthActivity } from '../lib/authEvents';

type AuthMode = 'register' | 'sign-in';

function explainError(error: unknown) {
  if (error instanceof ApiError && error.status === 503) {
    return 'Meld’s account or email services are not fully connected yet. Check the Firebase, Supabase and Mailjet settings with the project setup guide.';
  }
  if (error instanceof ApiError && error.status === 429) return 'Too many attempts. Wait a little before trying again.';
  if (error instanceof ApiError && error.status === 0) return error.message;
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/email-already-in-use') return 'An account already uses this email. Sign in instead or use another email address.';
    if (error.code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (error.code === 'auth/weak-password') return 'Choose a longer password with at least 12 characters.';
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') return 'Email or password is incorrect.';
    if (error.code === 'auth/too-many-requests') return 'Too many attempts. Wait a little before trying again.';
    if (error.code === 'auth/network-request-failed') return 'Meld could not reach Firebase. Check your connection and try again.';
    if (error.code === 'auth/unauthorized-continue-uri' || error.code === 'auth/unauthorized-domain') return 'This site address is not yet allowed in Firebase Authentication settings.';
    if (error.code === 'auth/operation-not-allowed') return 'Email and password sign-in has not been enabled in the Firebase project yet.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function VerificationDialog({
  user,
  onClose,
  onVerified,
  initialError,
}: {
  user: User;
  onClose: () => void;
  onVerified: () => Promise<boolean>;
  initialError: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    focusRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/auth/verification-email', { method: 'POST', body: JSON.stringify({}) });
      setCooldown(60);
      setNotice('A new verification link has been sent. Check your inbox and spam folder.');
    } catch (issue) {
      setError(explainError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function checkVerification() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await reload(user);
      if (!user.emailVerified) {
        setError('Meld has not received confirmation yet. Open the latest verification link, then try again.');
        return;
      }
      await user.getIdToken(true);
      await recordAuthActivity('email_verified');
      const entered = await onVerified();
      if (!entered) setError('Your email is verified. Meld is still connecting your account. Try again shortly.');
    } catch (issue) {
      setError(explainError(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="auth-dialog" ref={dialogRef} onClose={onClose} aria-labelledby="verify-title">
      <p className="eyebrow">EMAIL VERIFICATION</p>
      <h2 id="verify-title">Check your email</h2>
      <p>Email verification is required for your Meld account. Open the latest verification link sent to <strong>{user.email}</strong>, then return here. If you do not have a link, request one below and check your spam or promotions folder.</p>
      {error && <p className="form-message" role="alert">{error}</p>}
      {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
      <button className="button button--primary auth-submit" type="button" onClick={() => void checkVerification()} disabled={busy}>
        {busy ? 'Checking…' : 'I’ve verified my email'}
      </button>
      <div className="resend-row">
        <span>Didn’t receive the link?</span>
        <button ref={focusRef} type="button" onClick={() => void resend()} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
        </button>
      </div>
      <button className="dialog-close" type="button" onClick={onClose}>Close</button>
    </dialog>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh, status } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(() => {
    const existing = getFirebaseAuth()?.currentUser;
    return existing && !existing.emailVerified ? existing : null;
  });
  const [verificationOpen, setVerificationOpen] = useState(() => {
    const existing = getFirebaseAuth()?.currentUser;
    return Boolean(existing && !existing.emailVerified);
  });
  const verifiedNotice = new URLSearchParams(location.search).get('verified') === '1'
    || (location.state as { verified?: boolean } | null)?.verified;
  const resetComplete = new URLSearchParams(location.search).get('reset') === 'complete';

  useEffect(() => {
    if (status === 'signed-in') navigate('/app', { replace: true });
  }, [navigate, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResetNotice('');
    setVerificationError('');

    try {
      const auth = requireFirebaseAuth();
      const normalizedEmail = email.trim().toLowerCase();
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await recordAuthActivity('account_created');
        setPendingUser(credential.user);
        try {
          await updateProfile(credential.user, { displayName: fullName.trim() });
        } catch (issue) {
          setVerificationError(explainError(issue));
        }
        try {
          await apiRequest('/auth/verification-email', { method: 'POST', body: JSON.stringify({}) });
        } catch (issue) {
          setVerificationError(explainError(issue));
        }
        setVerificationOpen(true);
      } else {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await recordAuthActivity('sign_in_succeeded');
        if (!credential.user.emailVerified) {
          setPendingUser(credential.user);
          setVerificationOpen(true);
          setError('Verify your email before signing in. We can send another link from this window.');
          return;
        }
        const entered = await refresh();
        if (!entered) setError('Your sign-in is valid, but Meld’s profile service is unavailable right now. Try again shortly.');
      }
    } catch (issue) {
      setError(explainError(issue));
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email address first, then request a reset link.');
      return;
    }
    setResetBusy(true);
    setError('');
    setResetNotice('');
    try {
      await apiRequest('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email: normalizedEmail }) });
      setResetNotice('Request received. If a Meld account is linked to this email, a reset link will arrive shortly. Check your inbox, spam or promotions folder.');
    } catch (issue) {
      setError(explainError(issue));
    } finally {
      setResetBusy(false);
    }
  }

  async function handleVerified() {
    const entered = await refresh();
    if (entered) setVerificationOpen(false);
    return entered;
  }

  return (
    <main className="auth-page">
      <section className="auth-main" aria-labelledby="auth-title">
        <div className="auth-brand-row"><Link to="/" aria-label="Return to Meld home"><Brand /></Link></div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{isRegister ? 'GET STARTED WITH MELD' : 'WELCOME BACK'}</p>
          <h1 id="auth-title">{isRegister ? 'Create your account.' : 'Sign in to Meld.'}</h1>
          <p className="auth-intro">
            {isRegister ? 'A few details first. Verify your email using the secure link we send.' : 'Sign in to continue to your Meld account.'}
          </p>
          {(verifiedNotice || resetComplete || resetNotice || error || status === 'unavailable') && (
            <div className="auth-notices" aria-live="polite">
              {verifiedNotice && <p className="form-message form-message--success" role="status">Your email is verified. Meld is checking your account access.</p>}
              {resetComplete && <p className="form-message form-message--success" role="status">Your password has been updated. Sign in with your new password.</p>}
              {resetNotice && <p className="form-message form-message--success" role="status">{resetNotice}</p>}
              {error && <p className="form-message" role="alert">{error}</p>}
              {status === 'unavailable' && <p className="form-message" role="status">Account access is not configured yet. The public pages remain available.</p>}
            </div>
          )}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {isRegister && (
              <div className="field">
                <label htmlFor="full-name">Full name</label>
                <input id="full-name" name="fullName" type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={80} required />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isRegister ? 12 : 1} maxLength={128} required />
                <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {isRegister && <p className="field-hint">Use at least 12 characters. A longer passphrase is easier to remember and harder to guess.</p>}
            </div>
            {!isRegister && <button className="auth-forgot-link" type="button" onClick={() => void requestPasswordReset()} disabled={resetBusy}>{resetBusy ? 'Sending reset link…' : 'Forgot password?'}</button>}
            <button className="button button--primary auth-submit" type="submit" disabled={busy || status === 'unavailable'}>
              {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <p className="auth-switch">
            {isRegister ? <>Already have an account? <Link to="/sign-in">Sign in</Link></> : <>New to Meld? <Link to="/register">Create an account</Link></>}
          </p>
          <p className="auth-back"><Link to="/"><ArrowLeft aria-hidden="true" /> Back to Meld</Link></p>
        </div>
        <p className="auth-footnote">Meld is in development. Bill payments are not yet enabled.</p>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <picture><img src="/images/meld-auth-panel.webp" width="1536" height="2752" alt="" loading="eager" decoding="async" /></picture>
        <p className="auth-art-caption">A clearer view of everyday bill payments, with each step designed to be easy to follow.</p>
      </aside>
      {verificationOpen && pendingUser && <VerificationDialog user={pendingUser} onClose={() => setVerificationOpen(false)} onVerified={handleVerified} initialError={verificationError} />}
    </main>
  );
}
