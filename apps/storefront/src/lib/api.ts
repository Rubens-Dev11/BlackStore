import { createApiClient } from '@/lib/format';
import { getApiUrl } from './env';

export const api = createApiClient({
  baseUrl: getApiUrl(),
});
