/**
 * Kimlik doğrulama sayfalarının ortak kart düzeni.
 *
 * Kayıt, şifremi unuttum ve şifre sıfırlama sayfaları aynı yerleşimi
 * kullanıyor; başlık/içerik/alt bağlantı yapısını tek yerde toplamak,
 * sayfalar arasında görünüm farkı oluşmasını engelliyor.
 */
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-full flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-slate-600">{subtitle}</p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-900/5 sm:px-10">
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  );
}
