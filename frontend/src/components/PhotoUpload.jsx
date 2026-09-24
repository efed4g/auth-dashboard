import { useEffect, useRef, useState } from 'react';
import { useUploadPhotoMutation, useDeletePhotoMutation } from '../features/profile/profileApi';
import { getErrorMessage } from '../lib/errors';
import Button from './ui/Button';
import Alert from './ui/Alert';

/**
 * Profil fotoğrafı yükleme ve kaldırma.
 *
 * Buradaki tür ve boyut kontrolü yalnızca hızlı geri bildirim için; asıl
 * denetim sunucuda (upload.middleware.js), istemci kontrolü atlatılabilir.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoUpload({ photoUrl }) {
  const [uploadPhoto, { isLoading: uploading }] = useUploadPhotoMutation();
  const [deletePhoto, { isLoading: removing }] = useDeletePhotoMutation();

  // Gizli dosya girdisine programatik olarak tıklamak için.
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');

  // createObjectURL tarayıcı belleğinde adres tutuyor; serbest bırakılmazsa
  // bellek sızıntısı olur.
  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleSelect = async (event) => {
    const file = event.target.files?.[0];
    // Girdi sıfırlanmazsa tarayıcı aynı dosya için "değişiklik yok" deyip
    // olayı tetiklemiyor.
    event.target.value = '';
    if (!file) return;

    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Yalnızca JPEG, PNG veya WEBP yükleyebilirsiniz.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Dosya çok büyük. En fazla ${MAX_BYTES / 1024 / 1024} MB yükleyebilirsiniz.`);
      return;
    }

    const onizleme = URL.createObjectURL(file);
    setPreviewUrl(onizleme);

    try {
      // Alan adı "photo", sunucudaki upload.single('photo') ile eşleşmeli.
      const formData = new FormData();
      formData.append('photo', file);
      await uploadPhoto(formData).unwrap();
    } catch (err) {
      setError(getErrorMessage(err, 'Fotoğraf yüklenemedi.'));
      setPreviewUrl(null);
    }
  };

  const handleRemove = async () => {
    setError('');
    try {
      await deletePhoto().unwrap();
      setPreviewUrl(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Fotoğraf kaldırılamadı.'));
    }
  };

  // Yükleme sürerken yerel önizleme, bittiğinde sunucudaki adres gösteriliyor.
  const gosterilen = previewUrl || photoUrl;
  const mesgul = uploading || removing;

  return (
    <div className="flex items-center gap-5">
      {gosterilen ? (
        <img
          src={gosterilen}
          alt="Profil fotoğrafı önizlemesi"
          className="size-20 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <span className="text-2xl" aria-hidden="true">👤</span>
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-2">
        {/* Gizli: tarayıcının varsayılan dosya girdisi biçimlendirilemiyor. */}
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleSelect}
          className="sr-only"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-auto!"
            loading={uploading}
            disabled={mesgul}
            onClick={() => inputRef.current?.click()}
          >
            {photoUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
          </Button>

          {photoUrl && (
            <Button
              type="button"
              variant="ghost"
              loading={removing}
              disabled={mesgul}
              onClick={handleRemove}
            >
              Kaldır
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-500">JPEG, PNG veya WEBP · en fazla 2 MB</p>

        <Alert tone="error">{error}</Alert>
      </div>
    </div>
  );
}
