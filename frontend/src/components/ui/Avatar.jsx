import { useEffect, useState } from 'react';

/**
 * Profil fotoğrafı, yoksa baş harf.
 * Google avatar adresleri zaman zaman 403 dönebildiği için yükleme hatasında
 * da baş harfe düşer.
 */
export default function Avatar({ user, size = 'size-7', className = '' }) {
  const [failed, setFailed] = useState(false);

  // Kullanıcı değişince (ör. hesap değiştirme) hata durumu sıfırlanmalı.
  useEffect(() => setFailed(false), [user?.photoUrl]);

  const initial = (user?.displayName || user?.email)?.[0]?.toUpperCase() ?? '?';

  if (user?.photoUrl && !failed) {
    return (
      <img
        src={user.photoUrl}
        alt=""
        // Google, referrer gönderen isteklere 403 dönebiliyor.
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${size} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full
                  bg-brand-100 text-xs font-semibold text-brand-700 ${className}`}
    >
      {initial}
    </span>
  );
}
