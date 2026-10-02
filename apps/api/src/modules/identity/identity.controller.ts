import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IdentityCheckStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SellerAuthGuard } from '../sellers/guards/seller-auth.guard';
import { SellerRequestUser } from '../sellers/strategies/seller-jwt.strategy';
import { ReviewIdentityDto, SubmitIdentityDto } from './dto/identity.dto';
import { IDENTITY_IMAGE_MAX_BYTES, IdentityFiles, IdentityService } from './identity.service';

const sellerId = (req: Request) => (req.user as SellerRequestUser).sellerId;

@ApiTags('Vendeurs — vérification d’identité')
@ApiBearerAuth()
@Controller('seller/identity')
@UseGuards(SellerAuthGuard)
export class SellerIdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'État de la vérification d’identité du vendeur connecté' })
  getMine(@Req() req: Request) {
    return this.identityService.getMine(sellerId(req));
  }

  @Post()
  @ApiOperation({ summary: 'Envoyer sa pièce (CNI recto-verso ou passeport) et un selfie en la tenant' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'documentFront', maxCount: 1 },
        { name: 'documentBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      { limits: { fileSize: IDENTITY_IMAGE_MAX_BYTES, files: 3 } },
    ),
  )
  submit(@Req() req: Request, @Body() dto: SubmitIdentityDto, @UploadedFiles() files: IdentityFiles) {
    return this.identityService.submit(sellerId(req), dto, files);
  }
}

@ApiTags('Vendeurs — vérification d’identité (administration)')
@ApiBearerAuth()
@Controller('admin/identity-checks')
@UseGuards(JwtAuthGuard)
export class AdminIdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Vérifications par statut (à traiter par défaut), avec des liens de 10 minutes vers les photos' })
  @ApiQuery({ name: 'status', required: false, enum: IdentityCheckStatus })
  list(@Query('status', new ParseEnumPipe(IdentityCheckStatus, { optional: true })) status?: IdentityCheckStatus) {
    return this.identityService.list(status ?? 'pending');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Valider ou refuser une vérification (le vendeur est prévenu par e-mail)' })
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewIdentityDto) {
    return this.identityService.review(id, dto.decision, dto.note);
  }
}
