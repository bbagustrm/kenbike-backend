import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression'; // ✅ Install: npm i compression @types/compression

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // ✅ GZIP Compression - Hemat bandwidth hingga 70%
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Balance antara speed & compression
  }));

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // ✅ Penting untuk CORS images
  }));

  app.use(cookieParser());

  const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3001'];

  logger.log('info', `🔒 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

  // ✅ Static Assets dengan Cache Headers Optimal
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    maxAge: '1y', // Built-in cache
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      const origin = allowedOrigins[0];

      // CORS Headers
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // ✅ CRITICAL: Cache Control yang Agresif
      // Images jarang berubah, jadi cache 1 tahun aman
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      // ✅ Preload Hint untuk resource penting
      if (path.includes('logo') || path.includes('hero')) {
        res.setHeader('Link', '<' + path + '>; rel=preload; as=image');
      }
    },
  });

  // ✅ Enhanced CORS dengan Preconnect Hints
  app.enableCors({
    origin: (origin, callback) => {
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
    exposedHeaders: ['Set-Cookie', 'Link'], // ✅ Expose Link header untuk preload
  });

  // ✅ Global Middleware untuk Security Headers
  app.use((req, res, next) => {
    // Preconnect hints untuk frontend
    if (req.path === '/') {
      res.setHeader('Link', [
        `<${allowedOrigins[0]}>; rel=preconnect`,
        `<${allowedOrigins[0]}>; rel=dns-prefetch`,
      ].join(', '));
    }
    next();
  });
  app.use(bodyParser.json({ strict: false }));

  app.setGlobalPrefix('api/v1');
  await app.listen(3000);

  logger.log('info', '🚀 Server running on http://localhost:3000/api/v1');
  logger.log('info', '🖼️  Static files with CORS: http://localhost:3000/uploads/');
  logger.log('info', '🗜️  GZIP compression enabled');
  logger.log('info', '🍪 Cookie parser enabled');
}

bootstrap();