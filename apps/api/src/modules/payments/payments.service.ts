import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, Order, OrderItem, Product } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

type OrderWithItems = Order & { items: (OrderItem & { product: Product })[] };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly fileStorageService: FileStorageService,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    if (order.status !== 'pending') {
      throw new ConflictException('Seules les commandes en attente peuvent être payées');
    }

    const paymentReference = `BSP-${Date.now()}-${uuidv4().substring(0, 8)}`;

    let response;
    try {
      response = await axios.post(
        `${this.configService.get('CINETPAY_API_URL')}/payment`,
        {
          apikey: this.configService.get('CINETPAY_API_KEY'),
          site_id: this.configService.get('CINETPAY_SITE_ID'),
          transaction_id: paymentReference,
          amount: order.totalAmount,
          currency: this.configService.get('CINETPAY_CURRENCY'),
          description: `Commande BlackStore ${order.orderNumber}`,
          notify_url: this.configService.get('CINETPAY_NOTIFY_URL'),
          return_url: this.configService.get('CINETPAY_RETURN_URL'),
          customer_name: order.buyerName,
          customer_email: order.buyerEmail,
          customer_phone_number: order.buyerPhone || '',
          customer_address: 'Cameroun',
          customer_city: 'Douala',
          customer_country: 'CM',
          customer_state: 'CM',
          customer_zip_code: '00000',
          channels: 'ALL',
          lang: 'fr',
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const cinetPayData = error.response?.data;

        this.logger.error(
          `Erreur CinetPay lors de l'initiation du paiement (commande ${orderId}, ref ${paymentReference})`,
          {
            status,
            data: cinetPayData,
            message: error.message,
            code: error.code,
          },
        );

        if (status && status >= 400 && status < 500) {
          const reason =
            (typeof cinetPayData === 'object' &&
              cinetPayData !== null &&
              (cinetPayData.description || cinetPayData.message || cinetPayData.error)) ||
            'Requête refusée par le service de paiement';
          throw new BadRequestException(
            `Échec de l'initiation du paiement CinetPay: ${reason}`,
          );
        }

        throw new ServiceUnavailableException('Service de paiement temporairement indisponible');
      }

      this.logger.error(
        `Erreur inattendue lors de l'initiation du paiement (commande ${orderId})`,
        error,
      );
      throw new ServiceUnavailableException('Service de paiement temporairement indisponible');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentReference, status: 'pending' },
    });

    this.logger.log(`Paiement initié pour la commande ${orderId} — Ref: ${paymentReference}`);

    return {
      paymentToken: response.data.payment_token,
      paymentUrl: response.data.payment_url,
    };
  }

  handleNotifyGet() {
    this.logger.log('Ping GET reçu de CinetPay');
    return '';
  }

  async handleNotifyPost(body: { transaction_id?: string }) {
    const transactionId = body.transaction_id;

    if (!transactionId) {
      this.logger.warn('Webhook reçu sans transaction_id');
      return '';
    }

    const order = await this.prisma.order.findFirst({
      where: { paymentReference: transactionId },
    });

    if (!order) {
      this.logger.warn(`Aucune commande trouvée pour la transaction ${transactionId}`);
      return '';
    }

    if (order.status === 'paid' || order.status === 'failed') {
      this.logger.log(`Commande déjà traitée (${order.status}) — Ignoré`);
      return '';
    }

    await this.checkPaymentStatus(transactionId);
    return '';
  }

  async checkPaymentStatus(transactionId: string) {
    const response = await axios.post(
      `${this.configService.get('CINETPAY_API_URL')}/payment/check`,
      {
        apikey: this.configService.get('CINETPAY_API_KEY'),
        site_id: this.configService.get('CINETPAY_SITE_ID'),
        transaction_id: transactionId,
      },
    );

    const status = response.data.status;

    if (status === 'ACCEPTED') {
      const order = await this.prisma.order.findFirst({
        where: { paymentReference: transactionId },
        include: { items: { include: { product: true } } },
      });

      if (order) {
        await this.confirmPayment(order as OrderWithItems);
      }
    } else if (status === 'REFUSED') {
      await this.prisma.order.updateMany({
        where: { paymentReference: transactionId },
        data: { status: 'failed' },
      });
      this.logger.warn(`Paiement refusé pour la transaction ${transactionId}`);
    } else if (status === 'WAITING_FOR_CUSTOMER') {
      this.logger.log(`Paiement en attente côté client pour ${transactionId}`);
    }

    return '';
  }

  async confirmPayment(order: OrderWithItems) {
    await this.prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'paid', paidAt: new Date() },
      });

      for (const item of order.items) {
        const tokenValue = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(
          expiresAt.getHours() + (item.product.downloadExpiryHours || 72),
        );

        await prisma.downloadToken.create({
          data: {
            token: tokenValue,
            orderItemId: item.id,
            expiresAt,
            maxDownloads: item.product.maxDownloads || 3,
          },
        });
      }
    });

    const downloadTokens = await this.prisma.downloadToken.findMany({
      where: { orderItem: { orderId: order.id } },
      include: { orderItem: { include: { product: true } } },
    });

    const products = downloadTokens.map((t) => ({
      name: t.orderItem.product.name,
      downloadLink: '',
      expiry: t.expiresAt.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    const downloadLinks = await Promise.all(
      downloadTokens.map((t) =>
        this.fileStorageService.getPresignedUrl(t.orderItem.product.filePath ?? '', 900),
      ),
    );

    products.forEach((p, i) => {
      p.downloadLink = downloadLinks[i];
    });

    await this.emailService.sendDownloadEmail(
      order.buyerEmail,
      order.buyerName,
      products,
      downloadLinks,
    );

    this.logger.log(`Paiement confirmé pour la commande ${order.id} — Email envoyé`);
  }
}