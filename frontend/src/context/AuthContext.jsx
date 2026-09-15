import React, { createContext, useState, useEffect } from 'react';
import { fetchWithAutoRefresh } from '../helpers/fetchWithAutoRefresh';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sayfa ilk yüklendiğinde backend'den user bilgisi al
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetchWithAutoRefresh(`${apiUrl}/dashboard`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Auth required');
        const data = await res.json();
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Logout fonksiyonu
  const logout = async () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    await fetch(`${apiUrl}/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  // Tüm cihazlardan çıkış fonksiyonu
  const logoutAll = async () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    await fetch(`${apiUrl}/logout-all`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}