const DEFAULT_API_URL = 'http://localhost:3000';

export function getApiUrl(): string {
  const value = import.meta.env.VITE_API_URL;

  if (value) {
    return value.replace(/\/$/, '');
  }

  return DEFAULT_API_URL;
}
