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
import { ApiError } from '../services/httpClient';
import { restoreSession, setUnauthorizedHandler } from '../services/httpClient';
import { loadSession, saveStoredUser } from '../services/sessionStore';

interface AuthContextValue {
  user: AuthUser | null;
  isSignedIn: boolean;
  /** True until the stored session has been read and verified. */
  isRestoring: boolean;
  isRefreshingProfile: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSignedIn: false,
  isRestoring: true,
  isRefreshingProfile: false,
  signIn: () => Promise.reject(new Error('AuthProvider is missing.')),
  signOut: () => Promise.resolve(),
  refreshProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);

  const refreshProfile = useCallback(async () => {
    setIsRefreshingProfile(true);
    try {
      setUser(await fetchProfile());
    } catch {
    } finally {
      setIsRefreshingProfile(false);
    }
  }, []);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const authed = await signInRequest(credentials);
      setUser(authed);
      void refreshProfile();
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  /**
   * Restore the session on launch so closing and reopening the app does not
   * force a re-login.
   *
   * The stored cookie is never trusted on its own: it is seeded into the jar so
   * the verification call can carry it, then `/auth/me` decides whether it is
   * still good. A stored value can be stale — the session revoked, or the
   * device clock drifted past the real expiry — and trusting the cached profile
   * alone would show a signed-in shell whose every request 401s.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await loadSession();

        // loadSession already discards an expired entry and returns null.
        if (!stored) {
          return;
        }

        restoreSession(stored.cookie, stored.expiresAt);

        // Paint the cached profile first so the drawer is not empty while the
        // verification round trip is in flight.
        if (stored.user) {
          setUser(stored.user);
        }

        const verified = await fetchProfile();
        if (cancelled) {
          return;
        }
        setUser(verified);
        void saveStoredUser(verified);
      } catch (error) {
        // A 401 already ran clearSession, which wipes the stored copy. A plain
        // network failure does not: the cookie may still be good once the user
        // is back online, so keep it and simply show the login screen.
        if (!cancelled && !(error instanceof ApiError && error.status === 401)) {
          console.warn('[auth] could not verify the stored session', error);
        }
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isSignedIn: user !== null,
      isRestoring,
      isRefreshingProfile,
      signIn,
      signOut,
      refreshProfile,
    }),
    [isRestoring, isRefreshingProfile, refreshProfile, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
