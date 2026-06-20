import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TrackPageviewDto {
  @ApiPropertyOptional({ example: '36e6f433-8246-43b8-b2c6-0279d8b8939e' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ example: 'sess_abc123' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({ example: 'google' })
  @IsString()
  @IsOptional()
  utmSource?: string;

  @ApiPropertyOptional({ example: 'cpc' })
  @IsString()
  @IsOptional()
  utmMedium?: string;
}
