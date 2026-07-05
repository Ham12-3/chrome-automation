import { useState, useCallback } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('auth_token');
  });

  const isLoggedIn = !!token;

  const login = useCallback((newToken: string) => {
    sessionStorage.setItem('auth_token', newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_token');
    setToken(null);
  }, []);

  return { token, isLoggedIn, login, logout };
}
