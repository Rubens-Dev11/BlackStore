import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TrackPageviewDto {
  @ApiPropertyOptional({ example: '36e6f433-8246-43b8-b2c6-0279d8b8939e' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  /** Page d'une boutique : son adresse (/boutique/<slug>). */
  @ApiPropertyOptional({ example: 'awa-design' })
  @IsString()
  @Matches(/^[a-z0-9-]{1,40}$/)
  @IsOptional()
  storeSlug?: string;

  @ApiPropertyOptional({ example: 'sess_abc123' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ example: 'google' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  utmSource?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  utmMedium?: string;

  /** Site d'où vient le visiteur (« facebook.com »), quand ce n'est pas BlackStore. */
  @ApiPropertyOptional({ example: 'facebook.com' })
  @IsString()
  @Matches(/^[a-z0-9.-]{1,100}$/)
  @IsOptional()
  referrerHost?: string;
}
