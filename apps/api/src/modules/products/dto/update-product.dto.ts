import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsIn } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['android', 'desktop', 'multiplatform'], { message: 'Plateforme invalide' })
  platform?: 'android' | 'desktop' | 'multiplatform';
}