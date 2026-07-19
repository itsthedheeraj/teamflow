import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * AuthContext
 *
 * Single source of truth for auth state across the app.
 * Persists the JWT and user/org info to localStorage so the
 * user stays logged in on refresh.
 *
 * What's stored:
 *  - token:   the raw JWT (sent as Authorization: Bearer <token>)
 *  - user:    { id, email }
 *  - org:     { id, name, slug, subscriptionTier }
 *  - role:    'owner' | 'admin' | 'member'
 */

const AuthContext = createContext(null);

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(() => loadFromStorage());

  const setAuth = useCallback((data) => {
    if (data) {
      localStorage.setItem('auth', JSON.stringify(data));
      localStorage.setItem('token', data.token); // api.js reads this key
    } else {
      localStorage.removeItem('auth');
      localStorage.removeItem('token');
    }
    setAuthState(data);
  }, []);

  const logout = useCallback(() => setAuth(null), [setAuth]);

  const updateOrg = useCallback((token, org, role) => {
    setAuth({ ...auth, token, org, role });
  }, [auth, setAuth]);

  const refreshUser = useCallback(async () => {
    try {
      const { api } = await import('../lib/api');
      const data = await api.get('/auth/me');
      setAuth({
        token: data.token,
        user: data.user,
        org: data.org,
        role: data.role,
      });
    } catch (err) {
      console.error('Failed to refresh user', err);
    }
  }, [setAuth]);

  return (
    <AuthContext.Provider value={{ auth, setAuth, logout, updateOrg, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
