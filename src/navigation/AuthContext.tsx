import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchProfile,
  signIn as signInRequest,
  signOut as signOutRequest,
  type AuthUser,
  type Credentials,
} from '../services/authService';
import { setUnauthorizedHandler } from '../services/httpClient';

interface AuthContextValue {
  user: AuthUser | null;
  isSignedIn: boolean;
  /** True while a background profile refresh is in flight. */
  isRefreshingProfile: boolean;
  /** Resolves with the signed-in user; rejects with a displayable message. */
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the profile from `GET /auth/me`. Never rejects. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSignedIn: false,
  isRefreshingProfile: false,
  signIn: () => Promise.reject(new Error('AuthProvider is missing.')),
  signOut: () => Promise.resolve(),
  refreshProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

  const refreshProfile = useCallback(async () => {
    setIsRefreshingProfile(true);
    try {
      setUser(await fetchProfile());
    } catch {
      // Keep whatever we already have. A 401 has already been handled by the
      // unauthorized handler, which clears the session.
    } finally {
      setIsRefreshingProfile(false);
    }
  }, []);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const authed = await signInRequest(credentials);
      // Paint immediately from the login response, then let /auth/me confirm it.
      setUser(authed);
      void refreshProfile();
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } finally {
      // Clear locally even if the request failed, so a 401 or a dropped
      // connection can never leave the user stranded mid-session.
      setUser(null);
    }
  }, []);

  // A 401 from any request — or the cookie lapsing — drops us back to Login.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isSignedIn: user !== null,
      isRefreshingProfile,
      signIn,
      signOut,
      refreshProfile,
    }),
    [isRefreshingProfile, refreshProfile, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
