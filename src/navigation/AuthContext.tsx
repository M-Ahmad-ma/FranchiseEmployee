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
  isRefreshingProfile: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
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
