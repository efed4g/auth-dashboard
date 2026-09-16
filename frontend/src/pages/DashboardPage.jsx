import { Link } from 'react-router-dom';
import { useGetDashboardQuery } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Alert from '../components/ui/Alert';
import FullPageSpinner from '../components/ui/FullPageSpinner';

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useGetDashboardQuery();

  if (isLoading) return <FullPageSpinner label="Dashboard yükleniyor…" />;
  if (error) return <Alert tone="error">{getErrorMessage(error)}</Alert>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Hoş geldin, {data.user.email}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Bu sayfa yalnızca geçerli bir oturumla görüntülenebilir.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {data.widgets.map((widget) => (
          <StatCard key={widget.key} label={widget.label} value={widget.value} />
        ))}
      </dl>

      {/* Bu blok backend'den yalnızca admin'e gelir; user'a gizlenmez, gönderilmez. */}
      {data.admin && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Yönetici özeti</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              admin
            </span>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Toplam kullanıcı" value={data.admin.totalUsers} />
            <StatCard label="Doğrulanmış" value={data.admin.verifiedUsers} />
            <StatCard label="Aktif oturum" value={data.admin.activeSessions} />
          </dl>

          <Link
            to="/admin"
            className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Kullanıcı listesine git →
          </Link>
        </section>
      )}
    </div>
  );
}
