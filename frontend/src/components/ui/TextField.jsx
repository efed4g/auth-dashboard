import { useId } from 'react';

export default function TextField({ label, hint, error, className = '', ...props }) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
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
