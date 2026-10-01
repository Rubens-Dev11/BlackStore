import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SellerAuthGuard extends AuthGuard('seller-jwt') {}
