import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import {
  IDENTITY_IMAGE_MAX_BYTES,
  SELLER_IMAGE_TYPES,
  TONE_CLASSES,
  type IdentityDocumentType,
  type SellerIdentity,
  type SellerProfile,
} from '@/lib/seller-api';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS, INPUT_CLASS } from '@/components/form-field';

type PhotoField = 'documentFront' | 'documentBack' | 'selfie';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

/** Choix d'une photo avec son aperçu (l'image reste sur l'appareil jusqu'à l'envoi). */
function PhotoInput({ label, hint, file, onChange }: { label: string; hint: string; file: File | null; onChange: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!chosen) return;
    if (!SELLER_IMAGE_TYPES.includes(chosen.type)) return notify.error('La photo doit être au format JPG, PNG ou WebP');
    if (chosen.size > IDENTITY_IMAGE_MAX_BYTES) return notify.error('La photo doit faire au plus 8 Mo');
    onChange(chosen);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {preview ? <img src={preview} alt={label} className="h-full w-full object-cover" /> : <span className="px-2 text-center text-xs text-muted-foreground">{label}</span>}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <label className="inline-block cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          {file ? 'Changer la photo' : 'Choisir une photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="hidden" />
        </label>
      </div>
    </div>
  );
}

export function SellerIdentityPage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const { data: identity, isLoading, isError } = useQuery({
    queryKey: ['seller-identity'],
    queryFn: () => api.get<SellerIdentity>('/seller/identity', accessToken),
  });
  const { data: me } = useQuery({
    queryKey: ['seller-me'],
    queryFn: () => api.get<SellerProfile>('/seller/me', accessToken),
  });

  const [documentType, setDocumentType] = useState<IdentityDocumentType>('cni');
  const [fullName, setFullName] = useState('');
  const [photos, setPhotos] = useState<Record<PhotoField, File | null>>({ documentFront: null, documentBack: null, selfie: null });
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // Nom du compte proposé par défaut ; à corriger s'il diffère de la pièce.
  useEffect(() => {
    if (me && !fullName) setFullName(`${me.firstName} ${me.lastName}`);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPhoto = (field: PhotoField) => (file: File | null) => setPhotos((prev) => ({ ...prev, [field]: file }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) return notify.error('Indiquez votre nom complet tel qu’il figure sur la pièce');
    if (!photos.documentFront) return notify.error(documentType === 'cni' ? 'Ajoutez la photo du recto de votre CNI' : 'Ajoutez la photo de la page d’identité de votre passeport');
    if (documentType === 'cni' && !photos.documentBack) return notify.error('Ajoutez la photo du verso de votre CNI');
    if (!photos.selfie) return notify.error('Ajoutez votre selfie en tenant la pièce');
    if (!consent) return notify.error('Cochez la case d’accord pour envoyer vos documents');

    const body = new FormData();
    body.append('documentType', documentType);
    body.append('fullName', fullName.trim());
    body.append('consent', 'true');
    body.append('documentFront', photos.documentFront);
    if (documentType === 'cni' && photos.documentBack) body.append('documentBack', photos.documentBack);
    body.append('selfie', photos.selfie);
    setProgress(0);
    try {
      const updated = await api.postFormWithProgress<SellerIdentity>('/seller/identity', body, accessToken, setProgress);
      queryClient.setQueryData(['seller-identity'], updated);
      queryClient.invalidateQueries({ queryKey: ['seller-me'] });
      setPhotos({ documentFront: null, documentBack: null, selfie: null });
      notify.success('Documents envoyés : nous les vérifions sous 24 heures');
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !identity) return <p className="text-sm text-red-600">Impossible de charger votre vérification. Rechargez la page.</p>;

  const canSubmit = identity.status === 'none' || identity.status === 'rejected';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Vérification d'identité</h1>

      {identity.status === 'none' && (
        <p className="text-sm text-muted-foreground">
          Avant votre premier retrait, nous vérifions votre identité : c'est une protection contre la fraude, pour vous et pour
          vos clients. Envoyez une photo de votre CNI (recto et verso) ou de votre passeport, et un selfie en tenant la pièce.
        </p>
      )}
      {identity.status === 'pending' && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES.yellow}`}>
          Documents envoyés le {formatDate(identity.submittedAt)} : l'équipe BlackStore les vérifie sous 24 heures. Vous recevrez un
          e-mail dès que ce sera fait.
        </div>
      )}
      {identity.status === 'approved' && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES.green}`}>
          Identité vérifiée le {formatDate(identity.reviewedAt)} ({identity.fullName}). Vous pourrez retirer vos gains vers Mobile Money.
        </div>
      )}
      {identity.status === 'rejected' && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES.red}`}>
          Vérification refusée{identity.reviewNote ? <> : <strong>{identity.reviewNote}</strong></> : null}. Vos photos ont été effacées :
          envoyez-en de nouvelles ci-dessous.
        </div>
      )}

      {canSubmit && (
        <form onSubmit={submit} className="space-y-5 rounded-lg border bg-background p-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Pièce d'identité</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="documentType" checked={documentType === 'cni'} onChange={() => setDocumentType('cni')} />
              Carte nationale d'identité (CNI)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="documentType" checked={documentType === 'passport'} onChange={() => setDocumentType('passport')} />
              Passeport
            </label>
          </fieldset>

          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium">Nom complet, tel qu'il figure sur la pièce</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={160} className={INPUT_CLASS} />
          </div>

          <div className="space-y-4">
            <PhotoInput
              label={documentType === 'cni' ? 'Recto de la CNI' : 'Page d’identité du passeport'}
              hint="Toute la pièce visible, nette, sans reflet."
              file={photos.documentFront}
              onChange={setPhoto('documentFront')}
            />
            {documentType === 'cni' && (
              <PhotoInput label="Verso de la CNI" hint="Toute la pièce visible, nette, sans reflet." file={photos.documentBack} onChange={setPhoto('documentBack')} />
            )}
            <PhotoInput
              label="Selfie avec la pièce"
              hint="Votre visage et la pièce bien visibles, la pièce tenue à côté de votre visage."
              file={photos.selfie}
              onChange={setPhoto('selfie')}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              J'accepte que BlackStore conserve ces documents pour vérifier mon identité et lutter contre la fraude. Seule l'équipe
              BlackStore peut les consulter ; ils sont effacés si la vérification est refusée.
            </span>
          </label>

          {progress !== null && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{progress} %</p>
            </div>
          )}

          <button type="submit" disabled={progress !== null} className={BUTTON_CLASS}>
            {progress !== null ? 'Envoi...' : 'Envoyer mes documents'}
          </button>
        </form>
      )}
    </div>
  );
}
