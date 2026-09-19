import { useEffect, useState } from 'react';

/**
 * Kullanıcı avatarı: profil fotoğrafı, yoksa adının baş harfi.
 *
 * Fotoğraf her zaman yüklenmiyor. Google'ın avatar adresleri zaman zaman 403
 * dönebiliyor; bu durumda kırık resim simgesi göstermek yerine baş harfe
 * düşülüyor. Bu yüzden basit bir img yerine durum tutan bir bileşen gerekti.
 */
export default function Avatar({ user, size = 'size-7', className = '' }) {
  const [failed, setFailed] = useState(false);

  // Fotoğraf adresi değiştiğinde hata durumu sıfırlanmalı; aksi halde bir kez
  // başarısız olan kullanıcıdan sonra geçilen hesapta da baş harf görünürdü.
  useEffect(() => setFailed(false), [user?.photoUrl]);

  const initial = (user?.displayName || user?.email)?.[0]?.toUpperCase() ?? '?';

  if (user?.photoUrl && !failed) {
    return (
      <img
        src={user.photoUrl}
        // alt="": avatar dekoratif, yanında zaten kullanıcının adı yazıyor.
        // Metin eklemek ekran okuyucuda aynı bilgiyi iki kez okuturdu.
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
