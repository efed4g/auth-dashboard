# backend/Dockerfile
FROM node:18-alpine

# Çalışma dizinini ayarla
WORKDIR /app

# Paket dosyalarını kopyala ve kur
COPY package*.json ./
RUN npm install

# Tüm kodları kopyala
COPY . .

# Konteyner ayağa kalkarken önce veritabanı tablolarını oluştur, sonra sunucuyu başlat
CMD npx sequelize-cli db:migrate && npm run dev
