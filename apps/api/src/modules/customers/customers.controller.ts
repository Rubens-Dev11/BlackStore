import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { ClientAuthGuard, ClientRequest } from './client-auth.guard';
import { CustomersService } from './customers.service';
import { OpenSessionDto, RequestLoginLinkDto } from './dto/customers.dto';

@ApiTags('Espace client')
@Controller('client')
@UseGuards(IpThrottlerGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('lien')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Recevoir par e-mail un lien de connexion à son espace (même réponse que l’adresse ait des achats ou non)' })
  requestLink(@Body() dto: RequestLoginLinkDto) {
    return this.customersService.requestLoginLink(dto.email);
  }

  @Post('session')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Ouvrir une session de 30 jours avec le lien reçu (une seule fois)' })
  openSession(@Body() dto: OpenSessionDto) {
    return this.customersService.openSession(dto.jeton);
  }

  @Get('achats')
  @UseGuards(ClientAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Achats faits avec l’adresse de la session : liens de téléchargement, remboursements' })
  purchases(@Req() req: ClientRequest) {
    return this.customersService.purchases(req.client.email);
  }

  @Post('deconnexion')
  @HttpCode(200)
  @UseGuards(ClientAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fermer la session de cet appareil' })
  logout(@Req() req: ClientRequest) {
    return this.customersService.logout(req.client.sessionId);
  }
}
