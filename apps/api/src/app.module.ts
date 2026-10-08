import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { StoresModule } from './modules/stores/stores.module';
import { SellerProductsModule } from './modules/seller-products/seller-products.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IdentityModule } from './modules/identity/identity.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { LegalModule } from './modules/legal/legal.module';
import { SupportModule } from './modules/support/support.module';
import { BackupsModule } from './modules/backups/backups.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PromoCodesModule } from './modules/promo-codes/promo-codes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        APP_PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().default('minio'),
        MINIO_PORT: Joi.number().default(9000),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().default('blackstore-files'),
        MAIL_HOST: Joi.string().default('mailhog'),
        MAIL_PORT: Joi.number().default(1025),
        // Adresse publique de l'API : base des liens de téléchargement envoyés par e-mail.
        API_PUBLIC_URL: Joi.string().uri().default('http://localhost:3000'),
        // Adresse de l'espace vendeur : base des liens de confirmation et de réinitialisation.
        SELLER_APP_URL: Joi.string().uri().default('http://localhost:3002'),
        // Adresse de la boutique en ligne : base des liens publics des boutiques vendeurs.
        STOREFRONT_URL: Joi.string().uri().default('http://localhost:3001'),
        // Antivirus ClamAV (démon clamd) qui analyse les fichiers des vendeurs.
        CLAMAV_HOST: Joi.string().default('clamav'),
        CLAMAV_PORT: Joi.number().default(3310),
        // Sauvegardes : dossier des copies de la base (monté depuis le serveur) ; sur un poste sans
        // client PostgreSQL, conteneur où lancer pg_dump (essais locaux).
        BACKUP_DIR: Joi.string().optional(),
        BACKUP_PG_DOCKER_CONTAINER: Joi.string().optional(),
        BACKUP_STARTUP_DELAY_MS: Joi.number().optional(),
        // Copie hors du serveur (stockage compatible S3), désactivée si l'un des champs manque.
        BACKUP_S3_URL: Joi.string().uri().optional(),
        BACKUP_S3_REGION: Joi.string().optional(),
        BACKUP_S3_BUCKET: Joi.string().optional(),
        BACKUP_S3_ACCESS_KEY: Joi.string().optional(),
        BACKUP_S3_SECRET_KEY: Joi.string().optional(),
      }),
    }),

    PrismaModule,

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'redis'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    EmailModule,
    FileStorageModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    PaymentsModule,
    DownloadsModule,
    ReviewsModule,
    AnalyticsModule,
    DashboardModule,
    SellersModule,
    StoresModule,
    SellerProductsModule,
    ReportsModule,
    IdentityModule,
    WalletModule,
    LegalModule,
    SupportModule,
    BackupsModule,
    DisputesModule,
    CustomersModule,
    PromoCodesModule,
  ],
})
export class AppModule {}