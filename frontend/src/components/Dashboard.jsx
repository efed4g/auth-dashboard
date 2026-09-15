import React, { useState, useEffect } from 'react';
import { fetchWithAutoRefresh } from '../helpers/fetchWithAutoRefresh';

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    fetchWithAutoRefresh(`${apiUrl}/dashboard`)
      .then(async res => {
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Hata var');
        }
        const json = await res.json();
        setData(json);
        setError(null);
      })
      .catch(e => {
        setError(e.message);
        setData(null);
      });
  }, []);

  if (error) return <div>Hata: {error}</div>;
  if (!data) return <div>Yükleniyor...</div>;

  return (
    <div>
      <h2>Dashboard'a hoşgeldin!</h2>
      <p>{data.message}</p>
      <pre>{JSON.stringify(data.user, null, 2)}</pre>
    </div>
  );
}

export default Dashboard;