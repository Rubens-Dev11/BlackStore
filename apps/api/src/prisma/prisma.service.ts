import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('🗄️ Prisma connecté à PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🗄️ Prisma déconnecté');
  }

  /**
   * Gestion centralisée des erreurs Prisma
   */
  handleError(error: any): never {
    if (error?.code) {
      switch (error.code) {
        case 'P2002':
          const target = error.meta?.target ? ` (${error.meta.target})` : '';
          throw new ConflictException(`Une ressource avec ces données existe déjà${target}.`);
        
        case 'P2025':
          throw new NotFoundException('La ressource demandée est introuvable.');
        
        case 'P2003':
          throw new BadRequestException('Mise à jour impossible : contrainte de relation non respectée.');
          
        default:
          this.logger.error(`Erreur Prisma non gérée: ${error.code}`, error.stack);
          throw new InternalServerErrorException('Une erreur inattendue est survenue avec la base de données.');
      }
    }

    this.logger.error('Erreur inattendue de base de données', error?.stack || error);
    throw new InternalServerErrorException('Erreur serveur interne.');
  }
}
