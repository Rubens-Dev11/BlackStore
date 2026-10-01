import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { SellerProductsService } from './seller-products.service';
import {
  CreateSellerProductDto,
  SellerProductVisibilityDto,
  SubmitSellerProductDto,
  UpdateSellerProductDto,
} from './dto/seller-product.dto';
import { SELLER_FILE_MAX_BYTES, SELLER_IMAGE_MAX_BYTES, SELLER_SCREENSHOTS_MAX } from './seller-files';
import 'multer';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;
const fileBody = (field: string, multiple = false) => ({
  schema: {
    type: 'object',
    properties: {
      [field]: multiple
        ? { type: 'array', items: { type: 'string', format: 'binary' } }
        : { type: 'string', format: 'binary' },
    },
  },
});

// Le fichier d'un produit est écrit sur le disque au fil de la réception, jamais gardé entier en mémoire.
const productFileUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, done) => done(null, `blackstore-upload-${randomUUID()}`),
  }),
  limits: { fileSize: SELLER_FILE_MAX_BYTES, files: 1 },
});

@ApiTags('Vendeurs — produits')
@ApiBearerAuth()
@Controller('seller/products')
@UseGuards(SellerAuthGuard)
export class SellerProductsController {
  constructor(private readonly sellerProductsService: SellerProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Produits du vendeur connecté' })
  list(@Req() req: Request) {
    return this.sellerProductsService.list(sellerId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Créer un produit (brouillon)' })
  @ApiResponse({ status: 409, description: "Le vendeur n'a pas encore de boutique" })
  create(@Req() req: Request, @Body() dto: CreateSellerProductDto) {
    return this.sellerProductsService.create(sellerId(req), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un produit du vendeur" })
  get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.sellerProductsService.get(sellerId(req), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un produit' })
  update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSellerProductDto) {
    return this.sellerProductsService.update(sellerId(req), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un produit jamais commandé' })
  @ApiResponse({ status: 409, description: 'Produit déjà commandé : le masquer plutôt' })
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.sellerProductsService.remove(sellerId(req), id);
  }

  @Post(':id/file')
  @ApiOperation({ summary: 'Envoyer le fichier du produit (450 Mo maximum), analysé ensuite par l’antivirus' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody('file'))
  @UseInterceptors(productFileUpload)
  uploadFile(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.sellerProductsService.uploadFile(sellerId(req), id, file);
  }

  @Post(':id/cover')
  @ApiOperation({ summary: 'Envoyer la couverture (JPG, PNG ou WebP, 5 Mo maximum)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody('file'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SELLER_IMAGE_MAX_BYTES, files: 1 } }))
  uploadCover(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.sellerProductsService.uploadCover(sellerId(req), id, file);
  }

  @Post(':id/screenshots')
  @ApiOperation({ summary: "Remplacer les captures d'écran (8 au maximum, 5 Mo chacune)" })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody('files', true))
  @UseInterceptors(
    FilesInterceptor('files', SELLER_SCREENSHOTS_MAX, { limits: { fileSize: SELLER_IMAGE_MAX_BYTES, files: SELLER_SCREENSHOTS_MAX } }),
  )
  uploadScreenshots(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.sellerProductsService.uploadScreenshots(sellerId(req), id, files);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Soumettre le produit : validation par l’admin pour le premier, publication directe ensuite' })
  submit(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() _dto: SubmitSellerProductDto) {
    return this.sellerProductsService.submit(sellerId(req), id);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Afficher ou masquer un produit validé' })
  setVisibility(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SellerProductVisibilityDto) {
    return this.sellerProductsService.setVisibility(sellerId(req), id, dto.isActive);
  }
}
