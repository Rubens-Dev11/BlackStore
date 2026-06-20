/**
 * BlackStore Shared Types
 * Used across @blackstore/api, @blackstore/storefront, and @blackstore/admin
 */

export enum Platform {
  ANDROID = 'android',
  DESKTOP = 'desktop',
  MULTIPLATFORM = 'multiplatform',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  ORANGE_MONEY = 'orange_money',
  MTN_MOBILE_MONEY = 'mtn_mobile_money',
  CARD = 'card',
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface IProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  categoryId?: string;
  category?: ICategory;
  tags: string[];
  version?: string;
  fileSizeMb?: number;
  platform: Platform;
  coverImageUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  isActive: boolean;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  createdAt: Date;
}
