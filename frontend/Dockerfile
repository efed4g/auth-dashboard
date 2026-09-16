# frontend/Dockerfile — docker-compose ile geliştirme ortamı için.
FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

# --host olmadan sunucu yalnızca container içinden erişilebilir olur.
CMD ["yarn", "dev", "--host", "0.0.0.0"]
