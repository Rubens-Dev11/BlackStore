import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SellerStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellersService } from './sellers.service';
import { UpdateSellerStatusDto } from './dto/seller-account.dto';

@ApiTags('Vendeurs — administration')
@ApiBearerAuth()
@Controller('admin/sellers')
@UseGuards(JwtAuthGuard)
export class AdminSellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des vendeurs (admin)' })
  @ApiQuery({ name: 'status', required: false, enum: SellerStatus })
  list(@Query('status', new ParseEnumPipe(SellerStatus, { optional: true })) status?: SellerStatus) {
    return this.sellersService.listForAdmin(status);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: "Valider, suspendre ou remettre en attente un vendeur (admin)" })
  @ApiResponse({ status: 200, description: 'Statut modifié, vendeur prévenu par e-mail' })
  @ApiResponse({ status: 404, description: 'Vendeur introuvable' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSellerStatusDto) {
    return this.sellersService.setStatus(id, dto.status);
  }
}
