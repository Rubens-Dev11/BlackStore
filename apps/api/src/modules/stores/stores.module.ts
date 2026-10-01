import { Module } from '@nestjs/common';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { ProductsModule } from '../products/products.module';
import { StoresService } from './stores.service';
import { SellerStoreController } from './seller-store.controller';
import { StoresController } from './stores.controller';

@Module({
  imports: [FileStorageModule, ProductsModule],
  controllers: [SellerStoreController, StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
