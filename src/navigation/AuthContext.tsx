import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  fetchProfile,
  mergeAuthUser,
  signIn as signInRequest,
  signOut as signOutRequest,
  type AuthUser,
  type Credentials,
} from '../services/authService';
import { ApiError } from '../services/httpClient';
import {
  restoreSession,
  setForbiddenHandler,
  setUnauthorizedHandler,
} from '../services/httpClient';
import { loadSession, saveStoredUser } from '../services/sessionStore';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  type PermissionKey,
} from '../services/permissions';

interface AuthContextValue {
  user: AuthUser | null;
  isSignedIn: boolean;
  /** True until the stored session has been read and verified. */
  isRestoring: boolean;
  isRefreshingProfile: boolean;
  permissionKeys: readonly string[] | null;
  roles: string[];
  can: (key: PermissionKey) => boolean;
  canAny: (keys: readonly PermissionKey[]) => boolean;
  canAll: (keys: readonly PermissionKey[]) => boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSignedIn: false,
  isRestoring: true,
  isRefreshingProfile: false,
  permissionKeys: null,
  roles: [],
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  signIn: () => Promise.reject(new Error('AuthProvider is missing.')),
  signOut: () => Promise.resolve(),
  refreshProfile: () => Promise.resolve(),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const userRef = useRef<AuthUser | null>(null);

  const applyUser = useCallback((next: AuthUser | null) => {
    userRef.current = next;
    setUser(next);
  }, []);

  const refreshProfile = useCallback(async () => {
    setIsRefreshingProfile(true);
    try {
      const fetched = await fetchProfile();
      const merged = mergeAuthUser(userRef.current, fetched);
      applyUser(merged);
      void saveStoredUser(merged);
    } catch (error) {
      // A 401 already ran clearSession, which wipes the stored copy. A plain
      // network failure keeps the last verified profile; the drawer should
      // not empty out because a background refresh failed.
      if (error instanceof ApiError && error.status === 401) {
        applyUser(null);
      }
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [applyUser]);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const authed = await signInRequest(credentials);
      applyUser(authed);
      void saveStoredUser(authed);
      // `/auth/me` is still worth calling: the server may have changed the
      // role since the login response, and it verifies the cookie works.
      void refreshProfile();
    },
    [applyUser, refreshProfile],
  );

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } finally {
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    setUnauthorizedHandler(() => applyUser(null));
    setForbiddenHandler(() => {
      // The session is valid; only the role is stale. Pull the current keys so
      // the gates hide the screen/action that just failed.
      void refreshProfile();
    });
    return () => {
      setUnauthorizedHandler(null);
      setForbiddenHandler(null);
    };
  }, [applyUser, refreshProfile]);

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
          applyUser(stored.user);
        }

        const verified = mergeAuthUser(stored.user ?? null, await fetchProfile());
        if (cancelled) {
          return;
        }
        applyUser(verified);
        void saveStoredUser(verified);
      } catch (error) {
        // A 401 already ran clearSession, which wipes the stored copy. A plain
        // network failure does not: the cookie may still be good once the user
        // is back online, so keep it and simply show the login screen.
        if (!cancelled && !(error instanceof ApiError && error.status === 401)) {
          console.warn('[auth] could not verify the stored session', error);
        }
        if (!cancelled) {
          applyUser(null);
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
  }, [applyUser]);

  /**
   * The admin can change roles at any time. Re-read `/auth/me` whenever the app
   * comes back to the foreground so the drawer does not stay on the previous
   * role until a restart.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && userRef.current) {
        void refreshProfile();
      }
    });
    return () => subscription.remove();
  }, [refreshProfile]);

  const permissionKeys = user?.permissionKeys ?? null;

  const can = useCallback(
    (key: PermissionKey) => hasPermission(permissionKeys, key),
    [permissionKeys],
  );
  const canAny = useCallback(
    (keys: readonly PermissionKey[]) => hasAnyPermission(permissionKeys, keys),
    [permissionKeys],
  );
  const canAll = useCallback(
    (keys: readonly PermissionKey[]) => hasAllPermissions(permissionKeys, keys),
    [permissionKeys],
  );

  const value = useMemo(
    () => ({
      user,
      isSignedIn: user !== null,
      isRestoring,
      isRefreshingProfile,
      permissionKeys,
      roles: user?.roles ?? [],
      can,
      canAny,
      canAll,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      can,
      canAll,
      canAny,
      isRefreshingProfile,
      isRestoring,
      permissionKeys,
      refreshProfile,
      signIn,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
