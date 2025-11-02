import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  app.use(helmet());
  app.use(cookieParser());

  // ✅ Parse allowed origins dari environment variable
  const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3001'];

  logger.log('info', `🔒 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

  // ✅ PERBAIKAN: Static Assets dengan CORS Headers Lengkap (HANYA 1 KALI)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res, path, stat) => {
      // Gunakan origin pertama dari allowed list untuk static files
      const origin = allowedOrigins[0];

      // ⚠️ CRITICAL: Set semua header CORS yang diperlukan
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Optional: Cache control untuk performa
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    },
  });

  // ✅ CORS untuk API Routes (tidak berubah, sudah benar)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`❌ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(3000);
  logger.log('info', '🚀 Server running on http://localhost:3000/api/v1');
  logger.log('info', '🖼️  Static files with CORS: http://localhost:3000/uploads/');
  logger.log('info', '🍪 Cookie parser enabled');
}

bootstrap();