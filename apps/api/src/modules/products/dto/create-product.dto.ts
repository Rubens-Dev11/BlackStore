import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsNumber()
  @Min(500)
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
}