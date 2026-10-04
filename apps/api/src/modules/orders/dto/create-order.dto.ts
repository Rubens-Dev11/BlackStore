import { IsString, IsEmail, IsArray, ValidateNested, IsOptional, IsUrl, IsNumber, Min, MinLength, Equals } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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

  /** Conditions générales de vente et politique de remboursement acceptées (case à cocher). */
  // Seul un vrai booléen « true » vaut acceptation (la conversion automatique ferait de « false » un vrai).
  @Transform(({ obj }) => obj.acceptTerms === true)
  @Equals(true, { message: "Acceptez les conditions générales de vente pour passer commande" })
  acceptTerms!: boolean;
}