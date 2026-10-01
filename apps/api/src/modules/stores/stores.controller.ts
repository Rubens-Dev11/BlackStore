import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StoresService } from './stores.service';

@ApiTags('Boutiques')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Page publique d’une boutique et de ses produits' })
  @ApiResponse({ status: 404, description: 'Boutique introuvable ou vendeur non validé' })
  getPublic(@Param('slug') slug: string) {
    return this.storesService.getPublic(slug);
  }
}
