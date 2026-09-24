import { useId } from 'react';

/**
 * Etiketli form alanı.
 *
 * Etiket, ipucu metni ve hata durumunu bir arada yönetiyor; formlarda aynı
 * yapıyı tekrar tekrar yazmamak için.
 *
 * multiline uzun metinler için <textarea> render ediyor. Ayrı bir bileşen
 * açmak yerine burada: etiket/ipucu/hata düzeni ikisinde de birebir aynı ve
 * çoğaltmak ikisinin zamanla birbirinden ayrılması demekti.
 */
export default function TextField({
  label,
  hint,
  error,
  className = '',
  multiline = false,
  rows = 4,
  ...props
}) {
  // useId çakışmayan kimlik üretiyor; label ile input'un eşleşmesi için gerekli.
  const id = useId();
  const Element = multiline ? 'textarea' : 'input';

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <Element
        id={id}
        // Hata yalnızca renkle değil aria ile de bildiriliyor.
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : (hint ? `${id}-hint` : undefined)}
        // rows yalnızca textarea'da anlamlı; input'a verilmesi geçersiz HTML olurdu.
        rows={multiline ? rows : undefined}
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
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
