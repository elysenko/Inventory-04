import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/validation';

/** Comma-separated allowlist, or `*` to mirror any origin (dev/preview). */
function corsOrigin(): string[] | boolean {
  const raw = process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN;
  if (!raw || raw === '*') return true;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Every route lives under /api; the SPA's nginx proxies that prefix straight
  // through, so `GET /items` (unprefixed) must 404.
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strips properties with no DTO decorator — this is what stops a caller
      // self-elevating with `role: 'manager'` in a signup body, or stamping a
      // movement with somebody else's userId.
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Collapses Nest's default string[] into a single `{ message }` string so
      // every 400/401/403 shares one envelope the SPA can render inline.
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StockRoom API')
    .setDescription('Inventory management: items, locations, stock movements')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`StockRoom API listening on http://0.0.0.0:${port}/api`);
}

void bootstrap();
