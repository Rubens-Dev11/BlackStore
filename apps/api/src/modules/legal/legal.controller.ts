import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateLegalInfoDto } from './dto/legal-info.dto';
import { LegalService } from './legal.service';

@ApiTags('Pages légales')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  @ApiOperation({ summary: 'Éditeur, contact, hébergeur et règles de la marketplace, pour les pages légales' })
  publicInfo() {
    return this.legalService.publicInfo();
  }
}

@ApiTags('Pages légales — administration')
@ApiBearerAuth()
@Controller('admin/legal-info')
@UseGuards(JwtAuthGuard)
export class AdminLegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  @ApiOperation({ summary: "Identité de l'éditeur et contact" })
  get() {
    return this.legalService.adminInfo();
  }

  @Put()
  @ApiOperation({ summary: "Modifier l'identité de l'éditeur et le contact (pages légales)" })
  update(@Body() dto: UpdateLegalInfoDto) {
    return this.legalService.update(dto);
  }
}
