import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from './email.service';

@Processor('email-queue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'sendDownloadEmail':
          await this.emailService.sendDownloadEmail(
            job.data.to,
            job.data.customerName,
            job.data.products,
            job.data.downloadLinks,
          );
          break;
        case 'sendOrderConfirmation':
          await this.emailService.sendOrderConfirmation(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process job ${job.id}: ${message}`);
      throw error;
    }
  }
}