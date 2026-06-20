import { Controller, Get, Param, Res, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { DownloadsService } from './downloads.service';

@ApiTags('Downloads')
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Streaming sécurisé du fichier' })
  async downloadFile(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const stream = await this.downloadsService.streamFile(token, req);
    
    if (!stream) {
      throw new HttpException('Token invalide ou quota atteint', HttpStatus.FORBIDDEN);
    }
    
    return res.redirect(stream.presignedUrl);
  }
}
