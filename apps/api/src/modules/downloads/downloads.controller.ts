import { Controller, Get, Header, HttpException, Param, Res, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { DownloadsService } from './downloads.service';

@ApiTags('Downloads')
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get(':token/etat')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "État d'un lien (page explicative de la boutique), sans compter de téléchargement" })
  status(@Param('token') token: string) {
    return this.downloadsService.status(token);
  }

  @Get(':token')
  @ApiOperation({ summary: 'Streaming sécurisé du fichier' })
  async downloadFile(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const stream = await this.downloadsService.streamFile(token, req);
      return res.redirect(stream.presignedUrl);
    } catch (error) {
      // Lien ouvert depuis un e-mail : le client voit une page qui explique quoi faire,
      // pas une réponse technique. Les autres appels gardent l'erreur JSON.
      if (error instanceof HttpException && req.accepts(['json', 'html']) === 'html') {
        res.setHeader('Cache-Control', 'no-store');
        return res.redirect(303, this.downloadsService.errorPageUrl(token));
      }
      throw error;
    }
  }
}
