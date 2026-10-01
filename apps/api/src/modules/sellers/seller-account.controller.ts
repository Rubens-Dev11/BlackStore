import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SellersService } from './sellers.service';
import { SellerAuthGuard } from './guards/seller-auth.guard';
import { SellerRequestUser } from './strategies/seller-jwt.strategy';
import { ChangeSellerPasswordDto, UpdateSellerProfileDto } from './dto/seller-account.dto';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Vendeurs — compte')
@ApiBearerAuth()
@Controller('seller/me')
@UseGuards(SellerAuthGuard)
export class SellerAccountController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: 'Profil du vendeur connecté' })
  getProfile(@Req() req: Request) {
    return this.sellersService.getProfile(sellerId(req));
  }

  @Patch()
  @ApiOperation({ summary: 'Modifier son profil (nom, téléphone)' })
  updateProfile(@Req() req: Request, @Body() dto: UpdateSellerProfileDto) {
    return this.sellersService.updateProfile(sellerId(req), dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son mot de passe' })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié, toutes les sessions sont fermées' })
  @ApiResponse({ status: 400, description: 'Mot de passe actuel incorrect ou nouveau mot de passe invalide' })
  async changePassword(@Req() req: Request, @Body() dto: ChangeSellerPasswordDto) {
    await this.sellersService.changePassword(sellerId(req), dto);
    return { message: 'Mot de passe modifié' };
  }
}
