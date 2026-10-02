import { Module } from '@nestjs/common';
import { AntivirusModule } from '../antivirus/antivirus.module';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { ProductsModule } from '../products/products.module';
import { AdminProductReviewController } from './admin-product-review.controller';
import { AdminProductReviewService } from './admin-product-review.service';
import { SellerProductsController } from './seller-products.controller';
import { SellerProductsService } from './seller-products.service';

@Module({
  imports: [AntivirusModule, EmailModule, FileStorageModule, ProductsModule],
  controllers: [SellerProductsController, AdminProductReviewController],
  providers: [SellerProductsService, AdminProductReviewService],
  // Les signalements retirent un produit de vendeur par la même décision que la validation.
  exports: [AdminProductReviewService],
})
export class SellerProductsModule {}
