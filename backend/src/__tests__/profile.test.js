/**
 * Profil uçlarının uçtan uca testleri.
 *
 * Gerçek port açılmıyor: supertest app'i doğrudan çağırıyor. index.js yerine
 * app.js require edildiği için sunucu dinleme ve token temizlik zamanlayıcısı
 * devreye girmiyor (bkz. index.js'teki ayrımın gerekçesi).
 *
 * Kayıt ucu kullanılmıyor: o akış e-posta doğrulaması istiyor ve buradaki konu
 * profil. Kullanıcılar doğrudan modelden, doğrulanmış olarak açılıyor.
 */
const request = require('supertest');
const bcrypt = require('bcrypt');

const app = require('../app');
const { sequelize, User, Profile } = require('../models');

const SIFRE = 'test-sifre-123';
const KULLANICI_A = 'test-profil-a@example.com';
const KULLANICI_B = 'test-profil-b@example.com';
const KULLANICI_C = 'test-profil-c@example.com';
const TEST_EPOSTALARI = [KULLANICI_A, KULLANICI_B, KULLANICI_C];

// Sekiz alanın hepsi dolu: tamamlama oranının %100 çıkması bekleniyor.
const GECERLI_PROFIL = {
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  phone: '+90 555 123 45 67',
  birthDate: '1998-04-12',
  city: 'Ankara',
  district: 'Çankaya',
  address: 'Kızılay Mah. 1. Cadde No: 5',
  bio: 'Test kullanıcısı.',
};

async function kullaniciOlustur(email) {
  return User.create({
    email,
    password: await bcrypt.hash(SIFRE, 10),
    role: 'user',
    isVerified: true,
  });
}

/**
 * Giriş yapar ve GÜNCEL CSRF token'ını döner.
 *
 * İki kez /auth/csrf çağrılması bilinçli: giriş bir POST olduğu için önce bir
 * token gerekiyor, ama createSession başarılı girişte yeni bir csrfToken
 * cookie'si yazıyor. Eski değerle atılacak istek 403 alırdı.
 */
async function girisYap(ajan, email) {
  const ilk = await ajan.get('/api/auth/csrf').expect(200);

  await ajan
    .post('/api/auth/login')
    .set('X-CSRF-Token', ilk.body.csrfToken)
    .send({ email, password: SIFRE })
    .expect(200);

  const yeni = await ajan.get('/api/auth/csrf').expect(200);
  return yeni.body.csrfToken;
}

let ajanA;
let csrfA;
let kullaniciA;

beforeAll(async () => {
  await sequelize.authenticate();
  // Önceki çalışmadan kalmış olabilir. Profiller FK CASCADE ile düşüyor.
  await User.destroy({ where: { email: TEST_EPOSTALARI } });

  kullaniciA = await kullaniciOlustur(KULLANICI_A);
  await kullaniciOlustur(KULLANICI_B);

  // request.agent: cookie'leri istekler arasında taşıyor, tarayıcı gibi.
  ajanA = request.agent(app);
  csrfA = await girisYap(ajanA, KULLANICI_A);
});

afterAll(async () => {
  await User.destroy({ where: { email: TEST_EPOSTALARI } });
  // Kapatılmazsa Jest açık bağlantı havuzunu bekleyip asılı kalıyor.
  await sequelize.close();
});

describe('Profil uçları', () => {
  test('1) POST /api/profile profil oluşturur', async () => {
    const cevap = await ajanA
      .post('/api/profile')
      .set('X-CSRF-Token', csrfA)
      .send(GECERLI_PROFIL)
      .expect(201);

    expect(cevap.body.profile.firstName).toBe('Ayşe');
    // Kaynak zaten "isteği yapanın profili"; kimlik cevaba konmuyor.
    expect(cevap.body.profile).not.toHaveProperty('userId');
  });

  test('2) GET /api/profile kendi profilini ve tamamlama oranını döner', async () => {
    const cevap = await ajanA.get('/api/profile').expect(200);

    expect(cevap.body.profile.lastName).toBe('Yılmaz');
    expect(cevap.body.profile.city).toBe('Ankara');
    expect(cevap.body.completion.percent).toBe(100);
  });

  test('3) PUT /api/profile profili günceller ve değişiklik kalıcı olur', async () => {
    const cevap = await ajanA
      .put('/api/profile')
      .set('X-CSRF-Token', csrfA)
      .send({ ...GECERLI_PROFIL, city: 'İzmir', district: 'Konak' })
      .expect(200);

    expect(cevap.body.profile.city).toBe('İzmir');

    // Cevabın doğru olması yetmez, veri gerçekten yazıldı mı:
    const tekrar = await ajanA.get('/api/profile').expect(200);
    expect(tekrar.body.profile.district).toBe('Konak');
  });

  test('4) Oturum olmadan profile erişilemez', async () => {
    // agent değil düz request: hiçbir cookie taşınmıyor.
    await request(app).get('/api/profile').expect(401);
  });

  test('5) Kullanıcı yalnızca kendi profilini görüyor', async () => {
    const ajanB = request.agent(app);
    const csrfB = await girisYap(ajanB, KULLANICI_B);

    // B'nin profili yok: A'nınkini görmemeli, 200 + null almalı.
    const bosCevap = await ajanB.get('/api/profile').expect(200);
    expect(bosCevap.body.profile).toBeNull();

    await ajanB
      .post('/api/profile')
      .set('X-CSRF-Token', csrfB)
      .send({ firstName: 'Mehmet', lastName: 'Demir' })
      .expect(201);

    const bCevap = await ajanB.get('/api/profile').expect(200);
    const aCevap = await ajanA.get('/api/profile').expect(200);

    expect(bCevap.body.profile.firstName).toBe('Mehmet');
    expect(aCevap.body.profile.firstName).toBe('Ayşe');
  });

  // --- Bonus: ödevin "Ana Başarı Kriteri"nin doğrudan kanıtları ---

  test('6) Gövdeye yazılan userId dikkate alınmıyor', async () => {
    await kullaniciOlustur(KULLANICI_C);
    const kullaniciC = await User.findOne({ where: { email: KULLANICI_C } });

    const ajanC = request.agent(app);
    const csrfC = await girisYap(ajanC, KULLANICI_C);

    // C, gövdeye A'nın kimliğini yazıyor.
    await ajanC
      .post('/api/profile')
      .set('X-CSRF-Token', csrfC)
      .send({ firstName: 'Saldırgan', lastName: 'Deneme', userId: kullaniciA.id })
      .expect(201);

    const cKayit = await Profile.findOne({ where: { userId: kullaniciC.id } });
    const aKayit = await Profile.findOne({ where: { userId: kullaniciA.id } });

    // Kayıt C'ye açılmış, A'nınki hiç etkilenmemiş olmalı.
    expect(cKayit.firstName).toBe('Saldırgan');
    expect(aKayit.firstName).toBe('Ayşe');
  });

  test('7) CSRF başlığı olmadan yazma isteği reddediliyor', async () => {
    await ajanA
      .put('/api/profile')
      .send(GECERLI_PROFIL)
      .expect(403);
  });
});