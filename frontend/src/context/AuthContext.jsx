import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAccessToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logoutLocal = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logoutLocal);
  }, [logoutLocal]);

  // On app load, try silently refreshing using the httpOnly cookie
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post('/auth/refresh');
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
      } catch {
        // No valid session; user must log in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    logoutLocal();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
