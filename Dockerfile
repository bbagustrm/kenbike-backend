# ---- STAGE 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- STAGE 2: Run ----
FROM node:20-alpine
WORKDIR /usr/src/app

# Copy package files dan install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy prisma schema dan generate client di runtime stage
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]