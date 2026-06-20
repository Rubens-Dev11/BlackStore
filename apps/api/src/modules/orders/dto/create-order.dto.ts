import { IsString, IsEmail, IsArray, ValidateNested, IsOptional, IsUrl, IsNumber, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsEmail()
  customerEmail!: string;

  @IsString()
  @MinLength(2)
  customerName!: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  @IsOptional()
  utm_source?: string;

  @IsString()
  @IsOptional()
  utm_medium?: string;

  @IsString()
  @IsOptional()
  utm_campaign?: string;

  @IsString()
  @IsOptional()
  utm_content?: string;

  @IsUrl()
  @IsOptional()
  referrer_url?: string;
}