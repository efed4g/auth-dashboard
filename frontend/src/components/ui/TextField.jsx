import { useId } from 'react';

/**
 * Etiketli form alanı.
 *
 * Etiket, ipucu metni ve hata durumunu bir arada yönetiyor; formlarda aynı
 * yapıyı tekrar tekrar yazmamak için.
 */
export default function TextField({ label, hint, error, className = '', ...props }) {
  // useId, aynı sayfada birden fazla alan olduğunda çakışmayan kimlik üretiyor.
  // label ile input'un eşleşmesi için gerekli: etikete tıklayınca alan
  // odaklanıyor ve ekran okuyucu ikisini birlikte okuyor.
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        // Hata durumu yalnızca renkle değil aria ile de bildiriliyor;
        // renk körü kullanıcılar ve ekran okuyucular için gerekli.
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={
          'mt-1.5 block w-full rounded-lg border-0 px-3 py-2 text-slate-900 shadow-sm ' +
          'ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ' +
          'sm:text-sm ' +
          (error
            ? 'ring-red-400 focus:ring-red-500'
            : 'ring-slate-300 focus:ring-brand-600')
        }
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
