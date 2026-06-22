const DEFAULT_API_URL = 'http://localhost:3000';

export function getApiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;

  if (value) {
    return value.replace(/\/$/, '');
  }

  return DEFAULT_API_URL;
}

export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  return (value ?? 'http://localhost:3001').replace(/\/$/, '');
}
