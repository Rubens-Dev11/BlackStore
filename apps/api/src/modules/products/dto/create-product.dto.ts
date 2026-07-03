import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Min, MinLength, IsIn } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  compatibility?: string;

  @IsNumber()
  @IsOptional()
  downloadLimit?: number;

  @IsNumber()
  @IsOptional()
  downloadExpiryHours?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsOptional()
  @IsIn(['android', 'desktop', 'multiplatform'], { message: 'Plateforme invalide' })
  platform?: 'android' | 'desktop' | 'multiplatform';
}