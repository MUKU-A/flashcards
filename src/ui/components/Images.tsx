import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { getImageUrl, imagesVersion } from '../../images';

const lightbox = signal<string | null>(null);

export function useImageUrl(id: string): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const v = imagesVersion.value;
  useEffect(() => {
    let alive = true;
    getImageUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, v]);
  return url;
}

export function Img({ id, zoom = true }: { id: string; zoom?: boolean }) {
  const url = useImageUrl(id);
  if (url === undefined) return <span class="img-missing">読み込み中…</span>;
  if (url === null) return <span class="img-missing">画像を取得できません（同期すると表示されます）</span>;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onClick={(e) => {
        if (!zoom) return;
        e.stopPropagation();
        lightbox.value = url;
      }}
    />
  );
}

export function ImageRow({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div class="img-row">
      {ids.map((id) => (
        <Img key={id} id={id} />
      ))}
    </div>
  );
}

export function Lightbox() {
  const url = lightbox.value;
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') lightbox.value = null;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [url]);
  if (!url) return null;
  return (
    <div class="lightbox" onClick={() => (lightbox.value = null)}>
      <img src={url} alt="" />
    </div>
  );
}

export const isLightboxOpen = () => lightbox.value !== null;
