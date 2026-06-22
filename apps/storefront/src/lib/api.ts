import { createApiClient } from '@blackstore/shared';
import { getApiUrl } from './env';

export const api = createApiClient({
  baseUrl: getApiUrl(),
});
