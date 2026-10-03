import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * Identifiant (11 caractères) d'une vidéo YouTube tiré d'un lien youtube.com, m.youtube.com ou youtu.be
 * (vidéo classique, Short, intégration, direct) ; null pour tout autre lien.
 */
export function youTubeId(value: string): string | null {
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

/** Forme enregistrée en base, quelle que soit la forme du lien collé. */
export const youTubeUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const YOUTUBE_URL_PATTERN = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;

/**
 * Champ facultatif « lien d'une vidéo YouTube », comme la vidéo de présentation du Play Store :
 * un lien youtube.com ou youtu.be est ramené à sa forme canonique, une chaîne vide efface la vidéo
 * (null) et tout autre lien est refusé.
 */
export const YouTubeVideoUrl = () =>
  applyDecorators(
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const id = youTubeId(trimmed);
      return id ? youTubeUrl(id) : trimmed;
    }),
    IsOptional(),
    Matches(YOUTUBE_URL_PATTERN, { message: 'Collez le lien d’une vidéo YouTube (youtube.com ou youtu.be)' }),
  );
