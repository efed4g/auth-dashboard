const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-brand-600 hover:text-brand-700 hover:underline',
};

export default function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  const isGhost = variant === 'ghost';
  const base = isGhost
    ? 'inline-flex items-center gap-2 text-sm font-medium disabled:opacity-60'
    : 'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm ' +
      'font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 ' +
      'focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <button
      className={`${base} ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
