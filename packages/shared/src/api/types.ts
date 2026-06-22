import type { ICategory, IProduct, IOrder } from '../types';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CategoryWithCount extends ICategory {
  _count: {
    products: number;
  };
}

export type ProductListItem = Pick<
  IProduct,
  'id' | 'name' | 'slug' | 'price' | 'version' | 'isFeatured' | 'ratingAvg' | 'ratingCount'
> & {
  description?: string;
  viewCount?: number;
  createdAt?: string;
  category?: Pick<ICategory, 'id' | 'name' | 'slug'>;
};

export type ProductsListResponse = PaginatedResponse<ProductListItem>;

export interface LoginResponse {
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  conversionRate: number;
  totalProducts: number;
  pendingReviews: number;
  revenueLast30Days: number;
  ordersLast30Days: number;
}

export type { ICategory, IProduct, IOrder };
