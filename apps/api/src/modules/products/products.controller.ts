import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UploadedFile, UploadedFiles, UseInterceptors, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import 'multer';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des produits' })
  @ApiResponse({ status: 200, description: 'Liste des produits' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Produits en vedette' })
  @ApiResponse({ status: 200, description: 'Liste des produits en vedette' })
  async findFeatured() {
    return this.productsService.findFeatured();
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des produits' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  async search(@Query('q') q: string) {
    return this.productsService.search(q);
  }

  @Get('by-id/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Détails d\'un produit par ID (admin)' })
  @ApiResponse({ status: 200, description: 'Détails du produit' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liste complète des produits (admin)' })
  @ApiResponse({ status: 200, description: 'Tous les produits y compris inactifs' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async findAllAdmin() {
    return this.productsService.findAllAdmin();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Détails d\'un produit' })
  @ApiResponse({ status: 200, description: 'Détails du produit' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un produit' })
  @ApiResponse({ status: 201, description: 'Produit créé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un produit' })
  @ApiResponse({ status: 200, description: 'Produit mis à jour' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un produit' })
  @ApiResponse({ status: 200, description: 'Produit supprimé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/upload-file')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload du fichier du produit' })
  @ApiResponse({ status: 200, description: 'Fichier uploadé' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.productsService.uploadProductFile(id, file);
  }

  @Post(':id/upload-screenshots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload des captures d\'écran' })
  @ApiResponse({ status: 200, description: 'Captures uploadées' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Produit introuvable' })
  @UseInterceptors(FilesInterceptor('files', 8))
  async uploadScreenshots(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.productsService.uploadScreenshots(id, files);
  }
}
