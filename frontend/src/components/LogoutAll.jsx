import React, { useState } from 'react';

function LogoutAll({ onLogout }) {
  const [message, setMessage] = useState('');

  const handleLogoutAll = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const res = await fetch(`${apiUrl}/logout-all`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      setMessage(data.message || data.error);

      if (typeof onLogout === 'function') onLogout();
    } catch (err) {
      setMessage('İşlem başarısız!');
    }
  };

  return (
    <div>
      <button 
        onClick={handleLogoutAll} 
        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-red-700 transition"
      >
         Tüm Cihazlardan Çıkış
      </button>
      {message && <div className="text-red-500 mt-2 text-sm font-semibold">{message}</div>}
    </div>
  );
}

export default LogoutAll;
