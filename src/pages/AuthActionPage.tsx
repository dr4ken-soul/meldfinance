import { FirebaseError } from 'firebase/app';
import { applyActionCode, confirmPasswordReset, reload, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
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
    try {
      await confirmPasswordReset(auth, actionCode, password);
      setPassword('');
      setConfirmPassword('');
      setState('complete');
    } catch (issue) {
      setError(actionError(issue));
    }
  }

  return (
    <main className="auth-action-page">
      <div className="auth-action-brand"><Link to="/" aria-label="Meld home"><Brand /></Link></div>
      <section className="auth-action-card" aria-labelledby="auth-action-title">
        <p className="eyebrow">MELD ACCOUNT SECURITY</p>
        {state === 'checking' && <p className="auth-action-status" role="status">Checking your secure link…</p>}
        {state === 'ready' && mode === 'resetPassword' && (
          <>
            <h1 id="auth-action-title">Choose a new password.</h1>
            <p className="auth-action-copy">Set a new password for <strong>{email}</strong>. Use at least 12 characters.</p>
            <form className="auth-form" onSubmit={(event) => void resetPassword(event)}>
              <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              <div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
              {error && <p className="form-message" role="alert">{error}</p>}
              <button className="button button--primary auth-submit" type="submit">Update password</button>
            </form>
          </>
        )}
        {state === 'complete' && mode === 'verifyEmail' && (
          <>
            <h1 id="auth-action-title">Your email is verified.</h1>
            <p className="auth-action-copy">Your Meld account is ready. Continue to sign in and open your account.</p>
            <Link className="button button--primary auth-submit" to="/sign-in?verified=1">Continue to Meld</Link>
          </>
        )}
        {state === 'complete' && mode === 'resetPassword' && (
          <>
            <h1 id="auth-action-title">Password updated.</h1>
            <p className="auth-action-copy">Your new password is ready to use. Sign in to continue.</p>
            <Link className="button button--primary auth-submit" to="/sign-in?reset=complete">Return to sign in</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 id="auth-action-title">This link needs attention.</h1>
            <p className="form-message" role="alert">{error}</p>
            <Link className="button button--secondary auth-submit" to="/sign-in">Back to sign in</Link>
          </>
        )}
        {state === 'ready' && mode === 'resetPassword' && <p className="auth-action-back"><Link to="/sign-in">Cancel and return to sign in</Link></p>}
      </section>
    </main>
  );
}
