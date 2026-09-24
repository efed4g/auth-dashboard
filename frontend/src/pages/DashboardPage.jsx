import { Link } from 'react-router-dom';
import { useGetDashboardQuery } from '../features/auth/authApi';
import { getErrorMessage } from '../lib/errors';
import Alert from '../components/ui/Alert';
import FullPageSpinner from '../components/ui/FullPageSpinner';
import CompletionBar from '../components/CompletionBar';

/**
 * Panel sayfası. İçeriğin tamamı backend'den geliyor; sayfa yalnızca çiziyor.
 * Rol ayrımı da burada değil sunucuda yapılıyor.
 */

// Hem kullanıcı hem yönetici bölümünde kullanılıyor.
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <dt className="text-sm text-slate-500">{label}</dt>
      {/* truncate yerine break-words: e-posta boşluksuz tek kelime olduğu için
          truncate uzun adresleri "dagefex@gmail...." diye kesiyordu ve kartın
          tek işi olan bilgiyi gösteremiyordu. break-words yalnızca sığmadığında
          alt satıra taşırıyor, kısa değerler tek satırda kalıyor. */}
      <dd className="mt-1 break-words text-lg font-semibold text-slate-900">{value}</dd>
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
          Hoş geldin, {data.displayName}
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

      {data.profileCompletion && <CompletionBar completion={data.profileCompletion} />}

      {/* Yetki kontrolü değil, "veri geldi mi" kontrolü: yönetici özeti normal
          kullanıcının cevabında hiç yer almıyor. */}
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
            {/* "Toplam" öneki şart: yukarıdaki kartlarda da "Aktif oturum"
                yazıyor ama orası yalnızca bu kullanıcının oturumlarını
                sayıyor. Aynı ekranda aynı etiket iki farklı sayı gösteriyordu. */}
            <StatCard label="Toplam aktif oturum" value={data.admin.activeSessions} />
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
