# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# bcrypt native derleme gerektirebilir.
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Bağımlılıklar önce kopyalanır: kod değiştiğinde bu katman cache'ten gelir.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false && apk del .build-deps

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Tablolar migration ile oluşturulur, ardından sunucu başlar.
CMD ["sh", "-c", "yarn migrate && yarn start"]
