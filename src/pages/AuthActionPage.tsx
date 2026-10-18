import { FirebaseError } from 'firebase/app';
import { applyActionCode, confirmPasswordReset, reload, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
import { recordAuthActivity } from '../lib/authEvents';
import { getFirebaseAuth } from '../lib/firebase';

type ActionMode = 'resetPassword' | 'verifyEmail' | 'invalid';
type ActionState = 'checking' | 'ready' | 'complete' | 'error';

function actionError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/expired-action-code' || error.code === 'auth/invalid-action-code') return 'This link has expired or has already been used. Request a new link from Meld.';
    if (error.code === 'auth/weak-password') return 'Choose a longer password with at least 12 characters.';
    if (error.code === 'auth/network-request-failed') return 'Meld could not reach Firebase. Check your connection and try again.';
  }
  return 'Meld could not complete this link. Request a fresh one and try again.';
}

export function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') ?? 'invalid') as ActionMode;
  const actionCode = searchParams.get('oobCode') ?? '';
  const [state, setState] = useState<ActionState>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function checkAction() {
      const auth = getFirebaseAuth();
      if (!auth || !actionCode || (mode !== 'verifyEmail' && mode !== 'resetPassword')) {
        setError('This link is incomplete or is not supported by Meld. Request a fresh link from the sign-in page.');
        setState('error');
        return;
      }
      try {
        if (mode === 'resetPassword') {
          const accountEmail = await verifyPasswordResetCode(auth, actionCode);
          if (active) {
            setEmail(accountEmail);
            setState('ready');
          }
          return;
        }

        await applyActionCode(auth, actionCode);
        const currentUser = auth.currentUser;
        if (currentUser) {
          await reload(currentUser);
          if (currentUser.emailVerified) {
            await currentUser.getIdToken(true);
            await recordAuthActivity('email_verified');
          }
        }
        if (active) setState('complete');
      } catch (issue) {
        if (active) {
          setError(actionError(issue));
          setState('error');
        }
      }
    }
    void checkAction();
    return () => { active = false; };
  }, [actionCode, mode]);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Account access is temporarily unavailable. Try again shortly.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, actionCode, password);
      setPassword('');
      setConfirmPassword('');
      setState('complete');
    } catch (issue) {
      setError(actionError(issue));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-action-page">
      <div className="auth-action-layout">
        <section className="auth-action-main" aria-labelledby="auth-action-title">
          <header className="auth-action-header">
            <Link to="/" aria-label="Meld home"><Brand /></Link>
            <span className="auth-action-secure"><ShieldCheck aria-hidden="true" /> Secure account access</span>
          </header>
          <div className="auth-action-content">
            <p className="eyebrow">ACCOUNT SECURITY</p>
            {state === 'checking' && (
              <div className="auth-action-state" role="status">
                <span className="auth-action-state-icon"><ShieldCheck aria-hidden="true" /></span>
                <h1 id="auth-action-title">Checking your secure link.</h1>
                <p className="auth-action-copy">We’re confirming this one-time link with Firebase. This should only take a moment.</p>
              </div>
            )}
            {state === 'ready' && mode === 'resetPassword' && (
              <>
                <h1 id="auth-action-title">Choose a new password.</h1>
                <p className="auth-action-copy">Create a fresh password for <strong>{email}</strong>. A longer passphrase is easier to remember and harder to guess.</p>
                <form className="auth-form auth-action-form" onSubmit={(event) => void resetPassword(event)}>
                  <div className="field">
                    <label htmlFor="new-password">New password</label>
                    <div className="password-wrap">
                      <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
                      <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                    </div>
                    <p className="field-hint">Use at least 12 characters.</p>
                  </div>
                  <div className="field">
                    <label htmlFor="confirm-password">Confirm new password</label>
                    <div className="password-wrap">
                      <input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                      <button className="password-toggle" type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                    </div>
                  </div>
                  {error && <p className="form-message" role="alert">{error}</p>}
                  <button className="button button--primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Updating password…' : 'Save new password'}</button>
                </form>
                <p className="auth-action-footnote"><ShieldCheck aria-hidden="true" /> Your password is updated securely by Firebase. Meld never sees or stores it.</p>
                <p className="auth-action-back"><Link to="/sign-in"><ArrowLeft aria-hidden="true" /> Cancel and return to sign in</Link></p>
              </>
            )}
            {state === 'complete' && mode === 'verifyEmail' && (
              <div className="auth-action-state">
                <span className="auth-action-state-icon auth-action-state-icon--success"><ShieldCheck aria-hidden="true" /></span>
                <h1 id="auth-action-title">Your email is verified.</h1>
                <p className="auth-action-copy">Your Meld account is ready. Continue to sign in and open your account.</p>
                <Link className="button button--primary auth-submit" to="/sign-in?verified=1">Continue to Meld</Link>
              </div>
            )}
            {state === 'complete' && mode === 'resetPassword' && (
              <div className="auth-action-state">
                <span className="auth-action-state-icon auth-action-state-icon--success"><ShieldCheck aria-hidden="true" /></span>
                <h1 id="auth-action-title">Password updated.</h1>
                <p className="auth-action-copy">Your new password is ready to use. Sign in to continue.</p>
                <Link className="button button--primary auth-submit" to="/sign-in?reset=complete">Return to sign in</Link>
              </div>
            )}
            {state === 'error' && (
              <div className="auth-action-state">
                <span className="auth-action-state-icon auth-action-state-icon--warning"><ShieldCheck aria-hidden="true" /></span>
                <h1 id="auth-action-title">This link needs attention.</h1>
                <p className="form-message" role="alert">{error}</p>
                <Link className="button button--secondary auth-submit" to="/sign-in">Back to sign in</Link>
              </div>
            )}
          </div>
          <footer className="auth-action-footer">A safer way to manage everyday bills.</footer>
        </section>
        <aside className="auth-action-aside" aria-hidden="true">
          <picture><img src="/images/meld-auth-panel.webp" width="1536" height="2752" alt="" decoding="async" /></picture>
          <div className="auth-action-aside-copy"><span>MADE FOR PEACE OF MIND</span><p>Your account, back in your hands.</p></div>
        </aside>
      </div>
    </main>
  );
}
