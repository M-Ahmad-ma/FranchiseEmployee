import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  signIn as signInRequest,
  type AuthUser,
  type Credentials,
} from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  isSignedIn: boolean;
  /** Resolves with the signed-in user; rejects with a displayable message. */
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSignedIn: false,
  signIn: () => Promise.reject(new Error('AuthProvider is missing.')),
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const signIn = useCallback(async (credentials: Credentials) => {
    const authed = await signInRequest(credentials);
    setUser(authed);
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(
    () => ({ user, isSignedIn: user !== null, signIn, signOut }),
    [signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
