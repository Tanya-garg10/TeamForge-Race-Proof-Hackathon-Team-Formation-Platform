import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { apiFetch, getStoredToken, setStoredToken } from '@/src/lib/api';
import { firebaseAuth, googleProvider, verifyFirestoreConnection } from '@/src/lib/firebase';
import type { PublicUser } from '@/shared/types';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    timezone: string;
    skills: string[];
    preferredRoles: string[];
    weeklyAvailability: number;
    experienceLevel: PublicUser['experienceLevel'];
  }) => Promise<PublicUser>;
  loginWithGoogle: () => Promise<PublicUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<PublicUser | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    try {
      const data = await apiFetch<{ user: PublicUser }>('/api/auth/me');
      setUser(data.user);
    } catch {
      if (token) setStoredToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void verifyFirestoreConnection();
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: PublicUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      timezone: string;
      skills: string[];
      preferredRoles: string[];
      weeklyAvailability: number;
      experienceLevel: PublicUser['experienceLevel'];
    }) => {
      const data = await apiFetch<{ user: PublicUser; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStoredToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const loginWithGoogle = useCallback(async () => {
    const credential = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await credential.user.getIdToken();
    const data = await apiFetch<{ user: PublicUser; token: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error on logout
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
