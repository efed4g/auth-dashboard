import { useEffect, useState } from 'react';
import {
  useGetProfileQuery,
  useGetLocationsQuery,
  useCreateProfileMutation,
  useUpdateProfileMutation,
  useDeleteProfileMutation,
} from '../features/profile/profileApi';
import { getErrorMessage } from '../lib/errors';
import TextField from '../components/ui/TextField';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FullPageSpinner from '../components/ui/FullPageSpinner';
import PhotoUpload from '../components/PhotoUpload';
import CompletionBar from '../components/CompletionBar';

/**
 * Profil sayfası. Tek bileşen iki işi görüyor: profil yoksa oluşturma, varsa
 * düzenleme. Hangi durumda olduğu sunucudan gelen cevaptan anlaşılıyor.
 */

// Silme sonrası formu sıfırlarken tekrar kullanılıyor.
const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  birthDate: '',
  city: '',
  district: '',
  address: '',
  bio: '',
};

export default function ProfilePage() {
  const { data, isLoading, error: loadError } = useGetProfileQuery();
  const { data: locationData } = useGetLocationsQuery();
  const [createProfile, { isLoading: creating }] = useCreateProfileMutation();
  const [updateProfile, { isLoading: updating }] = useUpdateProfileMutation();
  const [deleteProfile, { isLoading: deleting }] = useDeleteProfileMutation();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ?? null: veri gelmeden undefined yerine net bir "profil yok" değeri.
  const profile = data?.profile ?? null;
  const isEdit = Boolean(profile);

  const cities = locationData?.cities ?? [];
  const districts = cities.find((item) => item.name === form.city)?.districts ?? [];

  // Tarih seçicinin üst sınırı. toISOString() UTC'ye çevirdiği için gece
  // yarısından sonra bir önceki günü verebiliyordu; yerel parçalardan kuruluyor.
  const bugun = (() => {
    const simdi = new Date();
    const ay = String(simdi.getMonth() + 1).padStart(2, '0');
    const gun = String(simdi.getDate()).padStart(2, '0');
    return `${simdi.getFullYear()}-${ay}-${gun}`;
  })();

  // useState yalnızca ilk render'da çalışıyor, veri ise sonradan geliyor.
  useEffect(() => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phone: profile.phone ?? '',
      birthDate: profile.birthDate ?? '',
      city: profile.city ?? '',
      district: profile.district ?? '',
      address: profile.address ?? '',
      bio: profile.bio ?? '',
    });
  }, [profile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    // Kullanıcı yazmaya başlayınca o alanın hatası kalksın.
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
  };

  const handleCityChange = (event) => {
    const { value } = event.target;
    setForm((previous) => ({ ...previous, city: value, district: '' }));
    setFieldErrors((previous) => ({ ...previous, city: undefined, district: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      // Aynı form iki uca hizmet ediyor.
      const action = isEdit ? updateProfile : createProfile;
      const response = await action(form).unwrap();
      setMessage(response.message);
    } catch (err) {
      // Backend alan bazlı hata döndüyse onları inputların altına dağıt.
      setFieldErrors(err?.data?.fields ?? {});
      setError(getErrorMessage(err, 'Profil kaydedilemedi.'));
    }
  };

  const handleDelete = async () => {
    // Geri alınamaz bir işlem; onay istemek gerekiyor.
    if (!window.confirm('Profiliniz silinecek. Emin misiniz?')) return;

    setError('');
    setMessage('');
    try {
      const response = await deleteProfile().unwrap();
      setForm(EMPTY_FORM);
      setMessage(response.message);
    } catch (err) {
      setError(getErrorMessage(err, 'Profil silinemedi.'));
    }
  };

  if (isLoading) return <FullPageSpinner label="Profil yükleniyor…" />;
  if (loadError) return <Alert tone="error">{getErrorMessage(loadError)}</Alert>;

  const saving = creating || updating;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? 'Profilim' : 'Profil oluştur'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isEdit
              ? 'Bilgilerini güncelleyebilirsin.'
              : 'Henüz bir profilin yok. Aşağıdaki formu doldurarak oluşturabilirsin.'}
          </p>
        </div>

        {isEdit && (
          <Button variant="danger" className="w-auto!" loading={deleting} onClick={handleDelete}>
            Profili sil
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
      >
        {/* Kartın üst şeridi. Yalnızca profil varken: oluşturma formunun
            üstünde %0'lık bir çubuk bilgi vermiyor. Oran sunucudan geliyor,
            kaydetmeden sonra kendiliğinden tazeleniyor (invalidatesTags). */}
        {isEdit && data?.completion && (
          <CompletionBar completion={data.completion} variant="strip" />
        )}

        <Alert tone="error">{error}</Alert>
        <Alert tone="success">{message}</Alert>

        {/* Fotoğraf formdan bağımsız: seçilir seçilmez yükleniyor, "kaydet"i
            beklemiyor. Profil oluşturulmadan da gösterilmiyor. */}
        {isEdit && (
          <div className="border-b border-slate-100 pb-5">
            <PhotoUpload photoUrl={profile?.photoUrl} />
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Ad"
            name="firstName"
            required
            value={form.firstName}
            onChange={handleChange}
            error={fieldErrors.firstName}
          />
          <TextField
            label="Soyad"
            name="lastName"
            required
            value={form.lastName}
            onChange={handleChange}
            error={fieldErrors.lastName}
          />
          <TextField
            label="Telefon"
            name="phone"
            type="tel"
            // Mobilde tam klavye yerine numara tuş takımı açılsın.
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
            error={fieldErrors.phone}
            hint="Örn: +90 555 123 45 67"
          />
          <TextField
            label="Doğum tarihi"
            name="birthDate"
            type="date"
            // Takvim gelecekteki günleri seçtirmiyor. Asıl kural yine
            // sunucuda (profileValidation.js); bu yalnızca erken uyarı.
            max={bugun}
            value={form.birthDate}
            onChange={handleChange}
            error={fieldErrors.birthDate}
          />

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-slate-700">
              Şehir
            </label>
            <select
              id="city"
              name="city"
              value={form.city}
              onChange={handleCityChange}
              className="mt-1.5 block w-full rounded-lg border-0 bg-white px-3 py-2 text-slate-900
                         shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset
                         focus:ring-brand-600 sm:text-sm"
            >
              <option value="">Seçiniz</option>
              {cities.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            {fieldErrors.city && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.city}</p>
            )}
          </div>

          <div>
            <label htmlFor="district" className="block text-sm font-medium text-slate-700">
              İlçe
            </label>
            <select
              id="district"
              name="district"
              value={form.district}
              onChange={handleChange}
              disabled={!form.city}
              className="mt-1.5 block w-full rounded-lg border-0 bg-white px-3 py-2 text-slate-900
                         shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset
                         focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400 sm:text-sm"
            >
              <option value="">{form.city ? 'Seçiniz' : 'Önce şehir seçin'}</option>
              {districts.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {fieldErrors.district && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.district}</p>
            )}
          </div>
        </div>

        {/* maxLength sınırları veritabanı sütunlarıyla aynı (profiles tablosu,
            profileValidation.js). Tarayıcı fazlasını yazdırmıyor; sunucu
            kontrolü yine de yerinde, istek elle de gönderilebilir. */}
        <TextField
          label="Adres"
          name="address"
          maxLength={255}
          value={form.address}
          onChange={handleChange}
          error={fieldErrors.address}
        />

        <TextField
          label="Hakkımda"
          name="bio"
          // 500 karakter tek satırlık bir kutuya sığmıyor; yazarken metnin
          // başını görememek en sık şikayet edilen şeydi.
          multiline
          rows={4}
          maxLength={500}
          value={form.bio}
          onChange={handleChange}
          error={fieldErrors.bio}
          hint={`${form.bio.length}/500 karakter.`}
        />

        <Button type="submit" loading={saving}>
          {isEdit ? 'Değişiklikleri kaydet' : 'Profili oluştur'}
        </Button>
      </form>
    </div>
  );
}