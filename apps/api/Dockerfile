FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "-r", "tsconfig-paths/register", "src/main.ts"]
