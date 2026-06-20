import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application with all middleware and configurations.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 1. Security headers
  app.use(helmet.default());

  // 2. CORS configuration
  app.enableCors({
    origin: [
      configService.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3001'),
      configService.get<string>('VITE_API_URL', 'http://localhost:3002'),
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
  });

  // 3. Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Cookie parser
  app.use(cookieParser());

  // 5. Swagger documentation (dev only)
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BlackStore API')
      .setDescription('API de la plateforme BlackStore — vente de produits numériques')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentification administrateur')
      .addTag('Products', 'Gestion des produits')
      .addTag('Categories', 'Gestion des catégories')
      .addTag('Orders', 'Gestion des commandes')
      .addTag('Payments', 'Paiement CinetPay')
      .addTag('Downloads', 'Téléchargement sécurisé')
      .addTag('Reviews', 'Avis clients')
      .addTag('Analytics', 'Tracking et analytics')
      .addTag('Dashboard', 'Tableau de bord admin')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    console.log('📄 Swagger disponible sur /docs');
  }

  // 6. Start server
  const port = configService.get<number>('APP_PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 BlackStore API démarrée sur le port ${port}`);
}

bootstrap();
