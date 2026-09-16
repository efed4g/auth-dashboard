import { useGetAdminUsersQuery } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Alert from '../components/ui/Alert';
import FullPageSpinner from '../components/ui/FullPageSpinner';

export default function AdminPage() {
  const { data, isLoading, error } = useGetAdminUsersQuery();

  if (isLoading) return <FullPageSpinner label="Kullanıcılar yükleniyor…" />;
  if (error) return <Alert tone="error">{getErrorMessage(error)}</Alert>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kullanıcılar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bu uca yalnızca <code className="text-xs">admin</code> rolü erişebilir;
          yetki kontrolü backend'de yapılır.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">E-posta</th>
              <th scope="col" className="px-6 py-3 font-medium">Rol</th>
              <th scope="col" className="px-6 py-3 font-medium">Doğrulanmış</th>
              <th scope="col" className="px-6 py-3 font-medium">Google</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-3 text-slate-900">{user.email}</td>
                <td className="px-6 py-3">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (user.role === 'admin'
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-600">{user.isVerified ? 'Evet' : 'Hayır'}</td>
                <td className="px-6 py-3 text-slate-600">
                  {user.hasGoogleAccount ? 'Bağlı' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
