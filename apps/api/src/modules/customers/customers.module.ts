import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ClientAuthGuard } from './client-auth.guard';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [EmailModule],
  controllers: [CustomersController],
  providers: [CustomersService, ClientAuthGuard],
})
export class CustomersModule {}
