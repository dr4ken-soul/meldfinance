import { onAuthStateChanged, reload, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { apiRequest, ApiError } from '../lib/api';
import { recordAuthActivity } from '../lib/authEvents';
import { getFirebaseAuth, hasFirebaseClientConfig } from '../lib/firebase';
import { AuthContext, type AuthStatus, type MeldUser } from './context';

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() => hasFirebaseClientConfig() ? 'loading' : 'unavailable');
  const [user, setUser] = useState<MeldUser | null>(null);

  const refresh = useCallback(async () => {
    const auth = getFirebaseAuth();
    const firebaseUser = auth?.currentUser;
    if (!auth) {
      setUser(null);
      setStatus('unavailable');
      return false;
    }
    if (!firebaseUser) {
      setUser(null);
      setStatus('signed-out');
      return false;
    }

    try {
      await reload(firebaseUser);
      if (!firebaseUser.emailVerified) {
        setUser(null);
        setStatus('signed-out');
        return false;
      }
      await firebaseUser.getIdToken(true);
      const result = await apiRequest<{ user: MeldUser }>('/auth/me');
      setUser(result.user);
      setStatus('signed-in');
      return true;
    } catch (error) {
      setUser(null);
      if (error instanceof ApiError && error.status === 503) setStatus('unavailable');
      else setStatus('signed-out');
      return false;
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        setStatus('signed-out');
      } else {
        void refresh();
      }
    });
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth?.currentUser) await recordAuthActivity('sign_out');
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setStatus(auth ? 'signed-out' : 'unavailable');
  }, []);

  const updateFullName = useCallback(async (fullName: string) => {
    const result = await apiRequest<{ user: MeldUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName }),
    });
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo(() => ({ status, user, refresh, signOut, updateFullName }), [status, user, refresh, signOut, updateFullName]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
