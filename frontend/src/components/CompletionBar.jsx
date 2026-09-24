import { Link } from 'react-router-dom';

/**
 * Profil tamamlama çubuğu.
 *
 * Oran backend'de hesaplanıyor (profile.service.js -> calculateCompletion),
 * burası yalnızca çiziyor. Aynı bilgi hem panelde hem profil sayfasında
 * gösterildiği için ortak bileşene alındı.
 *
 * @param {{percent: number, filled: number, total: number}} completion
 * @param {boolean} [showLink=true]
 *        Profil sayfasında false: kullanıcı zaten o sayfada, "profili tamamla"
 *        bağlantısı kendi üstüne yönlendirirdi.
 * @param {'card'|'strip'} [variant='card']
 *        card: panelde, diğer kartlarla aynı ağırlıkta duran kutu.
 *        strip: profil formunun üst şeridi. Ayrı kart olarak durduğunda
 *        formla aynı görsel ağırlığa sahipti ve %100'de yer kaplamaktan
 *        başka iş yapmıyordu.
 */
export default function CompletionBar({ completion, showLink = true, variant = 'card' }) {
  const { percent, filled, total } = completion;

  if (variant === 'strip') {
    return (
      <div className="border-b border-slate-100 pb-5">
        {percent === 100 ? (
          // Dolu bir çubuk "ne kadar kaldı" sorusuna cevap vermiyor; tamamlanmış
          // durum tek satırda anlatılıyor. Nokta biçimi SecurityPage ile aynı.
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <span className="text-emerald-600" aria-hidden="true">●</span>
            Profil bilgilerin eksiksiz.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Profil tamamlama
              </span>
              <span className="text-xs font-semibold text-slate-700">
                %{percent} · {filled}/{total} alan
              </span>
            </div>
            {/* Panel sürümünden ince: burası sayfanın konusu değil, üst bilgisi. */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Profil tamamlama</h2>
        <span className="text-sm font-semibold text-slate-900">%{percent}</span>
      </div>

      {/* overflow-hidden: iç çubuğun köşeleri dışarı taşmasın. */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        {percent === 100
          ? 'Profilin eksiksiz.'
          : `${total} alandan ${filled} tanesi dolu.`}
      </p>

      {showLink && percent < 100 && (
        <Link
          to="/profil"
          className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Profili tamamla →
        </Link>
      )}
    </section>
  );
}
