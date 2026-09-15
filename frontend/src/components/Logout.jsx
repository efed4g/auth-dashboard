import React, { useState } from 'react';

function Logout({ onLogout }) {
  const [message, setMessage] = useState('');
  const [logoutAll, setLogoutAll] = useState(false); // Checkbox state

  const handleLogout = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      // Kutucuk işaretliyse logout-all, değilse normal logout'a istek atar
      const endpoint = logoutAll ? `${apiUrl}/logout-all` : `${apiUrl}/logout`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include', // Cookie sildirmek için şart!
      });
      const data = await res.json();
      setMessage(data.message || data.error);

      // FE'de oturumu kapatıp başka ekrana/modele geçirmek için parent'a haber verebiliriz:
      if (typeof onLogout === 'function') onLogout();
    } catch (err) {
      setMessage('Çıkış işlemi başarısız!');
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-red-700 transition"
      >
        Çıkış Yap
      </button>
      
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input 
          type="checkbox" 
          checked={logoutAll} 
          onChange={(e) => setLogoutAll(e.target.checked)}
          className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
        />
        Tüm cihazlardan çıkış yap
      </label>

      {message && <p className="text-sm mt-2 text-gray-600">{message}</p>}
    </div>
  );
}

export default Logout;