/**
 * Hata, başarı ve bilgi mesajları için ortak kutu.
 */
const TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-100',
};

export default function Alert({ tone = 'info', children, className = '' }) {
  // İçerik boşsa hiç render edilmiyor. Bu sayede çağıran taraf her yerde
  // koşul yazmak yerine <Alert tone="error">{error}</Alert> diyebiliyor.
  if (!children) return null;

  return (
    <div
      // role="alert" ekran okuyucunun mesajı anında seslendirmesini sağlıyor;
      // hata dışındaki bilgiler için bu kadar araya girmesi gerekmediğinden
      // daha yumuşak olan "status" kullanılıyor.
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
