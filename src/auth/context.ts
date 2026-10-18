import { createContext } from 'react';

export type MeldUser = { id: string; fullName: string; email: string; emailVerified: boolean };
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable';
export type AuthContextValue = {
  status: AuthStatus;
  user: MeldUser | null;
  refresh: () => Promise<boolean>;
  signOut: () => Promise<void>;
  updateFullName: (fullName: string) => Promise<MeldUser>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
