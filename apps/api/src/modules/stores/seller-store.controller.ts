import { Body, Controller, Get, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { LOGO_MAX_BYTES, StoresService } from './stores.service';
import { UpsertStoreDto } from './dto/upsert-store.dto';
import 'multer';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Vendeurs — boutique')
@ApiBearerAuth()
@Controller('seller/store')
@UseGuards(SellerAuthGuard)
export class SellerStoreController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'Boutique du vendeur connecté ({ store: null } si elle n’existe pas encore)' })
  async getMine(@Req() req: Request) {
    return { store: await this.storesService.getMine(sellerId(req)) };
  }

  @Put()
  @ApiOperation({ summary: 'Créer ou modifier sa boutique' })
  @ApiResponse({ status: 409, description: 'Adresse déjà prise' })
  upsertMine(@Req() req: Request, @Body() dto: UpsertStoreDto) {
    return this.storesService.upsertMine(sellerId(req), dto);
  }

  @Post('logo')
  @ApiOperation({ summary: 'Envoyer le logo de sa boutique (JPG, PNG ou WebP, 2 Mo maximum)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES } }))
  uploadLogo(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    return this.storesService.uploadLogo(sellerId(req), file);
  }
}
