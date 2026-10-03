const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** Identifiant (11 caractères) d'une vidéo YouTube tiré d'un lien youtube.com ou youtu.be ; null sinon (même règle que l'API). */
export function youTubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : (url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null);
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export const YOUTUBE_URL_MESSAGE = 'Collez le lien d’une vidéo YouTube (youtube.com ou youtu.be)';

/** Image d'aperçu d'une vidéo YouTube. */
export const youTubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Lien pour regarder la vidéo sur YouTube. */
export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
