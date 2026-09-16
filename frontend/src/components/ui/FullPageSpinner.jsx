export default function FullPageSpinner({ label = 'Yükleniyor…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span
          aria-hidden="true"
          className="size-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
        />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
