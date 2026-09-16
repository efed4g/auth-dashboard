import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-bold text-slate-900">Sayfa bulunamadı</h1>
      <Link
        to="/dashboard"
        className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        Dashboard'a dön
      </Link>
    </div>
  );
}
