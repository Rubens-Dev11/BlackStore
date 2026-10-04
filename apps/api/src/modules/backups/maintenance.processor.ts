import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BackupsService, MAINTENANCE_QUEUE, MaintenanceJob } from './backups.service';

// Une maintenance à la fois : jamais deux sauvegardes en même temps.
@Processor(MAINTENANCE_QUEUE, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly backupsService: BackupsService) {
    super();
  }

  async process(job: Job<MaintenanceJob>): Promise<void> {
    await this.backupsService.runMaintenance(job.data?.trigger ?? 'schedule');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MaintenanceJob> | undefined, error: Error): void {
    this.logger.error(`Maintenance ${job?.id ?? ''} interrompue : ${error.message}`);
  }
}
