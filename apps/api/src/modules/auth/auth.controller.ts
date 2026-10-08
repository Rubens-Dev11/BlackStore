import { Controller, Post, Patch, Body, Res, HttpCode, HttpStatus, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmPasswordChangeDto } from './dto/confirm-password-change.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IpThrottlerGuard } from './guards/ip-throttler.guard';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Connexion administrateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, ou code de sécurité envoyé si le mot de passe doit être remplacé (passwordChangeRequired)' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives, ou code déjà envoyé il y a moins d’une minute' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    if ('passwordChangeRequired' in result) {
      return result;
    }

    this.setRefreshCookie(res, result.refreshToken);
    this.logger.log(`Login réussi pour l'email: ${loginDto.email}`);
    return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }

  @Post('password/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Remplacer le mot de passe avec le code reçu par e-mail, puis ouvrir la session' })
  @ApiResponse({ status: 200, description: 'Mot de passe remplacé, session ouverte' })
  @ApiResponse({ status: 400, description: 'Code incorrect (essais restants) ou nouveau mot de passe refusé' })
  @ApiResponse({ status: 410, description: 'Code expiré, déjà utilisé ou essais épuisés' })
  async confirmPasswordChange(@Body() dto: ConfirmPasswordChangeDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.confirmPasswordChange(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, refreshToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler access token via refresh token cookie' })
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      this.logger.warn('Tentative de rafraîchissement sans refresh token');
      throw new UnauthorizedException('Refresh token manquant');
    }

    const { accessToken } = await this.authService.refresh(refreshToken);
    this.logger.log('Token rafraîchi avec succès');
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnexion administrateur' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
    });

    this.logger.log('Déconnexion réussie');
    return { message: 'Déconnexion réussie' };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Changer le mot de passe de l'administrateur connecté" })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié, toutes les sessions sont fermées' })
  @ApiResponse({ status: 400, description: 'Mot de passe actuel incorrect ou nouveau mot de passe invalide' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword((req.user as { userId: string }).userId, dto);
    return { message: 'Mot de passe modifié' };
  }
}