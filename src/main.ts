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


  app.use('/api/v1/webhooks/biteship', (req: any, res: any, next: any) => {
    logger.log('info', '🔍 [BITESHIP] Incoming request', {
      method:        req.method,
      url:           req.url,
      contentType:   req.headers['content-type']   ?? '(none)',
      contentLength: req.headers['content-length'] ?? '(none)',
      userAgent:     req.headers['user-agent']     ?? '(none)',
      xForwardedFor: req.headers['x-forwarded-for'] ?? '(none)',
      allHeaders:    JSON.stringify(req.headers),
      timestamp:     new Date().toISOString(),
    });

    const contentLength = parseInt(req.headers['content-length'] ?? '-1', 10);
    const hasBody = contentLength > 0;

    if (!hasBody || req.method !== 'POST') {
      logger.log('info', `🔍 [BITESHIP] Installation test detected (method=${req.method}, contentLength=${contentLength})`);
      res.status(200).json({ status: 'ok' });
      return;
    }

    let chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        logger.log('info', '🔍 [BITESHIP] Raw body received', { raw, length: raw.length });

        req.body   = raw && raw.trim() ? JSON.parse(raw) : {};
        req._body  = true;
      } catch (err: any) {
        logger.warn('⚠️ [BITESHIP] Failed to parse body', { error: err.message });
        req.body  = {};
        req._body = true;
      }
      next();
    });

    req.on('error', (err: any) => {
      logger.error('❌ [BITESHIP] Stream error', { error: err.message });
      res.status(200).json({ status: 'ok' });
    });
  });
  // ════════════════════════════════════════════════════════════════
  // End Biteship webhook handler
  // ════════════════════════════════════════════════════════════════

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

  // ⚠️ Trust Cloudflare proxy untuk mendapatkan real IP
  app.set('trust proxy', true);

  // ✅ Payload size limits
  app.use(bodyParser.json({
    limit: '1mb',
    strict: false,
  }));
  app.use(bodyParser.urlencoded({
    limit: '1mb',
    extended: true
  }));

  // Endpoint upload dengan limit lebih besar
  app.use('/api/v1/upload', bodyParser.json({
    limit: '10mb',
    strict: false,
  }));

  // ✅ CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3001'];

  logger.log('info', `🔒 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

  // Uploads path
  const uploadsPath = join(process.cwd(), 'uploads');

  if (existsSync(uploadsPath)) {
    logger.log('info', `📁 Uploads path found: ${uploadsPath}`);
  } else {
    logger.error('error', `❌ Uploads path NOT FOUND: ${uploadsPath}`);
  }

  // ✅ Static assets (uploaded files)
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (path.includes('logo') || path.includes('hero')) {
        res.setHeader('Link', '<' + path + '>; rel=preload; as=image');
      }
    },
  });

  // ✅ CORS for API endpoints
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

  // Preconnect hints
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

  await app.listen(3000, '0.0.0.0');

  // ✅ Startup logs
  const cacheEnabled   = process.env.ENABLE_CACHE === 'true';
  const loadTestMode   = process.env.LOAD_TEST_MODE === 'true';
  const rateLimit      = process.env.RATE_LIMIT_REQUESTS ?? '100';
  const rateLimitTTL   = parseInt(process.env.RATE_LIMIT_TTL ?? '60000') / 1000;

  logger.log('info', '═══════════════════════════════════════════════');
  logger.log('info', '🚀 Server running on http://0.0.0.0:3000/api/v1');
  logger.log('info', `🖼️  Static files: http://0.0.0.0:3000/uploads/ -> ${uploadsPath}`);
  logger.log('info', '🗜️  GZIP compression: ENABLED');
  logger.log('info', '🍪 Cookie parser: ENABLED');
  logger.log('info', `🛡️  DDoS Protection: ${loadTestMode ? '⚠️  BYPASSED (LOAD_TEST_MODE=true)' : 'ENABLED'}`);
  logger.log('info', `🔒 Rate Limiting: ${process.env.RATE_LIMIT_ENABLED === 'false' ? 'DISABLED' : `ENABLED (${rateLimit} req/${rateLimitTTL}s)`}`);
  logger.log('info', '🔐 Helmet Security Headers: ENABLED');
  logger.log('info', '🌐 Cloudflare Proxy: TRUSTED');
  logger.log('info', `📦 Redis Cache: ${cacheEnabled ? '✅ ENABLED' : '🔴 DISABLED (Baseline mode)'}`);
  if (cacheEnabled) {
    logger.log('info', `   ├─ Product list TTL : ${process.env.CACHE_TTL_PRODUCT_LIST ?? 180}s`);
    logger.log('info', `   ├─ Product detail TTL: ${process.env.CACHE_TTL_PRODUCTS ?? 300}s`);
    logger.log('info', `   ├─ Categories TTL   : ${process.env.CACHE_TTL_CATEGORIES ?? 600}s`);
    logger.log('info', `   ├─ Tags TTL         : ${process.env.CACHE_TTL_TAGS ?? 600}s`);
    logger.log('info', `   └─ Promotions TTL   : ${process.env.CACHE_TTL_PROMOTIONS ?? 300}s`);
  }
  logger.log('info', '📦 Payload Limits:');
  logger.log('info', '   ├─ Default: 1MB');
  logger.log('info', '   └─ Upload: 10MB');
  logger.log('info', '🔗 Biteship Webhook: /api/v1/webhooks/biteship');
  if (loadTestMode) {
    logger.log('info', '');
    logger.log('info', '⚠️  ====================================');
    logger.log('info', '⚠️  LOAD TEST MODE AKTIF!');
    logger.log('info', '⚠️  DDoS protection dinonaktifkan.');
    logger.log('info', '⚠️  Set LOAD_TEST_MODE=false setelah selesai!');
    logger.log('info', '⚠️  ====================================');
  }
  logger.log('info', '═══════════════════════════════════════════════');
}

bootstrap();