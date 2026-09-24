import { useEffect, useState } from 'react';

/**
 * Kullanıcı avatarı: profil fotoğrafı, yoksa adının baş harfi.
 *
 * Google'ın avatar adresleri 403 dönebiliyor; kırık resim simgesi yerine baş
 * harfe düşmek için durum tutan bir bileşen gerekti.
 */
export default function Avatar({ user, size = 'size-7', className = '' }) {
  const [failed, setFailed] = useState(false);

  // Sıfırlanmazsa bir kez başarısız olan adresten sonra geçilen hesapta da
  // baş harf görünürdü.
  useEffect(() => setFailed(false), [user?.photoUrl]);

  const initial = (user?.displayName || user?.email)?.[0]?.toUpperCase() ?? '?';

  if (user?.photoUrl && !failed) {
    return (
      <img
        src={user.photoUrl}
        // alt="": yanında zaten kullanıcının adı yazıyor, ekran okuyucu aynı
        // bilgiyi iki kez okumasın.
        alt=""
        // Google, referrer başlığı gönderen isteklere 403 dönebiliyor.
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
