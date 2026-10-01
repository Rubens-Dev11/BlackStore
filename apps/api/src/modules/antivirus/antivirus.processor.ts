import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AntivirusService, FILE_SCAN_QUEUE, FileScanJob } from './antivirus.service';

// Deux analyses à la fois au plus : ClamAV sollicite fortement le processeur.
@Processor(FILE_SCAN_QUEUE, { concurrency: 2 })
export class AntivirusProcessor extends WorkerHost {
  private readonly logger = new Logger(AntivirusProcessor.name);

  constructor(private readonly antivirusService: AntivirusService) {
    super();
  }

  async process(job: Job<FileScanJob>): Promise<void> {
    await this.antivirusService.scanProductFile(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<FileScanJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    this.logger.warn(`Analyse ${job.data.objectKey} : essai ${job.attemptsMade}/${attempts} échoué (${error.message})`);
    if (job.attemptsMade >= attempts) {
      await this.antivirusService.markFailed(job.data, error.message);
    }
  }
}
