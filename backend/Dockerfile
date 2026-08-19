FROM node:20-alpine

WORKDIR /app

# Копируем package.json и устанавливаем ВСЕ зависимости (включая dev — нужны для сборки)
COPY package*.json ./
RUN npm ci

# Копируем остальные файлы
COPY . .

# Генерируем Prisma Client
RUN npx prisma generate

# Билдим TypeScript
RUN npm run build

# Удаляем dev-зависимости после сборки (уменьшаем образ)
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["npm", "start"]
