import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initialiser paiement CinetPay' })
  @ApiResponse({ status: 201, description: 'Paiement initié' })
  @ApiResponse({ status: 404, description: 'Commande introuvable' })
  @ApiResponse({ status: 409, description: 'Commande non en attente' })
  async initiatePayment(@Body('orderId') orderId: string) {
    return this.paymentsService.initiatePayment(orderId);
  }

  @Get('notify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ping de disponibilité CinetPay' })
  @ApiResponse({ status: 200, description: 'Ping reçu' })
  handleNotifyGet() {
    return this.paymentsService.handleNotifyGet();
  }

  @Post('notify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Notification CinetPay (Webhook)' })
  @ApiResponse({ status: 200, description: 'Webhook traité' })
  async handleNotifyPost(@Body() body: any) {
    return this.paymentsService.handleNotifyPost(body);
  }
}
