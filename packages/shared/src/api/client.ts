import { ApiError } from './errors';

export interface ApiClientConfig {
  baseUrl: string;
  credentials?: RequestCredentials;
  getAccessToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

interface NestJsErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

function buildUrl(baseUrl: string, path: string, params?: ApiRequestOptions['params']): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function parseErrorMessage(body: NestJsErrorBody, fallback: string): string {
  if (Array.isArray(body.message)) {
    return body.message.join(', ');
  }
  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  if (typeof body.error === 'string' && body.error.length > 0) {
    return body.error;
  }
  return fallback;
}

export class ApiClient {
  private readonly config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      params,
      headers,
      credentials = this.config.credentials,
      signal,
    } = options;

    const url = buildUrl(this.config.baseUrl, path, params);
    const requestHeaders = new Headers(headers);

    if (body !== undefined && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    const accessToken = this.config.getAccessToken?.();
    if (accessToken) {
      requestHeaders.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials,
      signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (response.status === 401) {
        this.config.onUnauthorized?.();
      }

      const errorBody =
        typeof payload === 'object' && payload !== null
          ? (payload as NestJsErrorBody)
          : ({} as NestJsErrorBody);

      throw new ApiError(
        response.status,
        errorBody.error ?? 'HTTP_ERROR',
        parseErrorMessage(errorBody, `Erreur HTTP ${response.status}`),
        payload,
      );
    }

    return payload as T;
  }

  get<T>(path: string, params?: ApiRequestOptions['params'], signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: 'GET', params, signal });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: Pick<ApiRequestOptions, 'params' | 'signal' | 'headers'>,
  ): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, ...options });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: Pick<ApiRequestOptions, 'params' | 'signal' | 'headers'>,
  ): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body, ...options });
  }

  delete<T>(path: string, params?: ApiRequestOptions['params']): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', params });
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
