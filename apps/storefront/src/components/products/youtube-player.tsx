'use client';
import { useState } from 'react';
import { Play } from 'lucide-react';
import { youTubeEmbedUrl, youTubeThumbnail } from '@/lib/youtube';

interface Props {
  videoId: string;
  title: string;
  /** Petit libellé affiché sur l'aperçu, ex. « Vidéo de présentation ». */
  label?: string;
}

/**
 * Vidéo YouTube au format 16/9. Seule l'image d'aperçu est chargée au départ : le lecteur YouTube
 * (lourd pour une connexion mobile) ne se charge que lorsque le visiteur appuie sur lecture.
 */
export function YouTubePlayer({ videoId, title, label }: Props) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={youTubeEmbedUrl(videoId)}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className="group absolute inset-0 h-full w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={youTubeThumbnail(videoId)} alt="" className="h-full w-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-black/40 transition-transform group-hover:scale-110 group-focus-visible:scale-110">
        <Play className="ml-1 h-7 w-7 fill-white text-white" />
      </span>
      {label && (
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
          <Play className="h-3 w-3 fill-white" />
          {label}
        </span>
      )}
    </button>
  );
}
