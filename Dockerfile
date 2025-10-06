# ---- STAGE 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json & lockfile
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build

# ---- STAGE 2: Run ----
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy only production deps
COPY package*.json ./
RUN npm install --only=production

# Copy dist & prisma artifacts from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Expose app port
EXPOSE 3000

CMD ["node", "dist/main.js"]
