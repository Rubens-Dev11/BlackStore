import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { IpThrottlerGuard } from '../auth/guards/ip-throttler.guard';
import { SellersService } from './sellers.service';
import {
  LoginSellerDto,
  RegisterSellerDto,
  ResetSellerPasswordDto,
  SellerEmailDto,
  SellerTokenDto,
} from './dto/seller-auth.dto';

// Distinct du cookie administrateur, pour qu'une session vendeur n'écrase pas l'autre.
const REFRESH_COOKIE = 'seller_refresh_token';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Vendeurs — connexion')
@Controller('seller/auth')
@UseGuards(IpThrottlerGuard)
export class SellerAuthController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly configService: ConfigService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
    };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Inscription d'un vendeur" })
  @ApiResponse({ status: 201, description: 'Compte créé, e-mail de confirmation envoyé' })
  @ApiResponse({ status: 409, description: 'E-mail déjà utilisé' })
  register(@Body() dto: RegisterSellerDto) {
    return this.sellersService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Confirmation de l'adresse e-mail (lien reçu par e-mail)" })
  @ApiResponse({ status: 400, description: 'Lien invalide ou expiré' })
  verifyEmail(@Body() dto: SellerTokenDto) {
    return this.sellersService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Renvoi du lien de confirmation' })
  resendVerification(@Body() dto: SellerEmailDto) {
    return this.sellersService.resendVerification(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Connexion vendeur' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  @ApiResponse({ status: 403, description: 'E-mail non confirmé ou compte suspendu (champ code)' })
  async login(@Body() dto: LoginSellerDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.sellersService.login(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...this.cookieOptions(), maxAge: REFRESH_MAX_AGE_MS });
    return tokens;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renouvellement du jeton d'accès (cookie de session vendeur)" })
  refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Session expirée');
    }
    return this.sellersService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déconnexion vendeur' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { message: 'Déconnexion réussie' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Demande de lien de réinitialisation du mot de passe' })
  forgotPassword(@Body() dto: SellerEmailDto) {
    return this.sellersService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Nouveau mot de passe (lien reçu par e-mail)' })
  @ApiResponse({ status: 400, description: 'Lien invalide ou expiré' })
  resetPassword(@Body() dto: ResetSellerPasswordDto) {
    return this.sellersService.resetPassword(dto);
  }
}
