import { IsNumber, IsOptional, IsUUID, IsBoolean, Max, Min } from 'class-validator';

export class ProductQueryDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}