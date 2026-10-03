'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { youTubeId, youTubeThumbnail } from '@/lib/youtube';
import { YouTubePlayer } from './youtube-player';

type Media = { kind: 'video'; id: string } | { kind: 'cover'; url: string } | { kind: 'screenshot'; url: string };

interface Props {
  name: string;
  coverImageUrl: string | null;
  screenshots: string[];
  demoVideoUrl: string | null;
}

/** Même fichier, quel que soit le lien signé qui y mène. */
const samePath = (a: string, b: string) => a.split('?')[0] === b.split('?')[0];

/**
 * Galerie de la fiche produit, comme sur le Play Store : la vidéo de présentation d'abord,
 * puis la couverture et les captures, en grand, avec une rangée de miniatures pour passer de l'une à l'autre.
 */
export function ProductMedia({ name, coverImageUrl, screenshots, demoVideoUrl }: Props) {
  const videoId = youTubeId(demoVideoUrl);
  const media: Media[] = [
    ...(videoId ? [{ kind: 'video' as const, id: videoId }] : []),
    ...(coverImageUrl ? [{ kind: 'cover' as const, url: coverImageUrl }] : []),
    ...screenshots
      .filter((url) => url.startsWith('http') && !(coverImageUrl && samePath(url, coverImageUrl)))
      .map((url) => ({ kind: 'screenshot' as const, url })),
  ];
  const [selected, setSelected] = useState(0);
  const current = media[selected] ?? media[0];
  const firstScreenshot = media.findIndex((item) => item.kind === 'screenshot');

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 animate-fade-in">
        {!current && <div className="flex h-full items-center justify-center text-6xl text-zinc-600">📦</div>}
        {current?.kind === 'video' && <YouTubePlayer key={current.id} videoId={current.id} title={`${name} — vidéo de présentation`} label="Vidéo de présentation" />}
        {current?.kind === 'cover' && (
          <Image src={current.url} alt={name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
        )}
        {current?.kind === 'screenshot' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={`${name} — capture d'écran`} className="h-full w-full object-contain" />
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 animate-fade-in" style={{ animationDelay: '0.25s' }}>
          {media.map((item, i) => {
            const label =
              item.kind === 'video' ? 'Voir la vidéo de présentation' : item.kind === 'cover' ? "Voir l'image principale" : `Voir la capture ${i - firstScreenshot + 1}`;
            const src = item.kind === 'video' ? youTubeThumbnail(item.id) : item.url;
            return (
              <button
                key={item.kind === 'video' ? `video-${item.id}` : item.url}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={label}
                aria-pressed={i === selected}
                className={`relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg border bg-zinc-800 transition ${
                  i === selected ? 'border-orange-500 ring-2 ring-orange-500' : 'border-zinc-700 opacity-80 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                {item.kind === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-white text-white" />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
