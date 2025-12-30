import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import * as bodyParser from 'body-parser';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // ✅ Compression middleware
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
  }));

  // ✅ Security headers with helmet
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ✅ Cookie parser
  app.use(cookieParser());
  app.set('trust proxy', 1);

  // ✅ UPDATED: Payload size limits untuk proteksi DDoS
  // Default limit untuk semua endpoints
  app.use(bodyParser.json({
    limit: '1mb',
    strict: false,
  }));
  app.use(bodyParser.urlencoded({
    limit: '1mb',
    extended: true
  }));

  app.use('/api/v1/upload', bodyParser.json({
    limit: '10mb',
    strict: false,
  }));

  const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3001'];

  logger.log('info', `🔒 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

  const uploadsPath = join(process.cwd(), 'uploads');

  if (existsSync(uploadsPath)) {
    logger.log('info', `📁 Uploads path found: ${uploadsPath}`);
  } else {
    logger.error('error', `❌ Uploads path NOT FOUND: ${uploadsPath}`);
  }

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      const origin = allowedOrigins[0];
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (path.includes('logo') || path.includes('hero')) {
        res.setHeader('Link', '<' + path + '>; rel=preload; as=image');
      }
    },
  });

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
    exposedHeaders: ['Set-Cookie', 'Link'],
  });

  app.use((req, res, next) => {
    if (req.path === '/') {
      res.setHeader('Link', [
        `<${allowedOrigins[0]}>; rel=preconnect`,
        `<${allowedOrigins[0]}>; rel=dns-prefetch`,
      ].join(', '));
    }
    next();
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(3000);

  // ✅ Enhanced startup logs
  logger.log('info', '═══════════════════════════════════════════════');
  logger.log('info', '🚀 Server running on http://localhost:3000/api/v1');
  logger.log('info', `🖼️  Static files: http://localhost:3000/uploads/ -> ${uploadsPath}`);
  logger.log('info', '🗜️  GZIP compression: ENABLED');
  logger.log('info', '🍪 Cookie parser: ENABLED');
  logger.log('info', '🛡️  DDoS Protection: ENABLED');
  logger.log('info', '🔒 Rate Limiting: ENABLED');
  logger.log('info', '   ├─ Short: 10 req/sec');
  logger.log('info', '   ├─ Medium: 100 req/min');
  logger.log('info', '   └─ Long: 500 req/15min');
  logger.log('info', '🔐 Helmet Security Headers: ENABLED');
  logger.log('info', '📦 Payload Limits:');
  logger.log('info', '   ├─ Default: 1MB');
  logger.log('info', '   └─ Upload: 10MB');
  logger.log('info', '═══════════════════════════════════════════════');
}

bootstrap();