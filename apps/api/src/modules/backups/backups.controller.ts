import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupsService } from './backups.service';

@ApiTags('Sauvegardes — administration')
@ApiBearerAuth()
@Controller('admin/backups')
@UseGuards(JwtAuthGuard)
export class AdminBackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  @ApiOperation({ summary: 'État des sauvegardes : dernières copies de la base, fichiers, copie hors du serveur, disque' })
  status() {
    return this.backupsService.status();
  }

  @Get('health')
  @ApiOperation({ summary: 'Dernière sauvegarde de la base récente et réussie ? (pastille du menu)' })
  health() {
    return this.backupsService.health();
  }

  @Post('run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Lancer tout de suite une sauvegarde (base, fichiers, purge des données anciennes)' })
  run() {
    return this.backupsService.requestRun();
  }
}
