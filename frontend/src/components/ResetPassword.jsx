import React, { useState } from 'react';

function ResetPassword({ token, onComplete }) {
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const apiUrl = import.meta.env.VITE_API_URL;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        try {
            const res = await fetch(`${apiUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setTimeout(onComplete, 2000);
            }
            else setError(data.error);
        } catch (err) {
            setError('Bağlantı hatası.');
        }
    };

    return (
        <div className="bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Yeni Şifre Belirle</h2>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">

                    {error && <div className="mb-4 bg-red-100 text-red-700 px-4 py-3 rounded relative">{error}</div>}
                    {message && <div className="mb-4 bg-green-100 text-green-700 px-4 py-3 rounded relative">{message}</div>}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Yeni Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none">
                            Şifreyi Güncelle
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
