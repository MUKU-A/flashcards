/** 画像の取り込み（縮小）・保存・表示用 URL の取得 */
import { signal } from '@preact/signals';
import { db } from './db';
import { downloadBlob } from './sync/drive';
import { validToken } from './sync/auth';
import { uuid } from './util';

const MAX_SIDE = 1600;

async function processImage(file: Blob): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // 解析できない形式はそのまま保存
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  // 小さい PNG（図やスクリーンショット）は文字がにじまないようにそのまま使う
  if (scale === 1 && file.type === 'image/png' && file.size < 600_000) {
    bmp.close();
    return file;
  }
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
}

/** 画像ファイルを取り込んで ID を返す */
export async function importImage(file: Blob): Promise<string> {
  const blob = await processImage(file);
  const id = uuid();
  await db.images.put({ id, mime: blob.type || 'image/jpeg', blob, createdAt: Date.now() });
  return id;
}

const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
/** 画像が新たに取得されたら増える（表示の再試行に使う） */
export const imagesVersion = signal(0);

/** 表示用 URL。端末にも Drive にもない（またはオフライン）なら null */
export function getImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(id);
  if (running) return running;
  const p = (async () => {
    const rec = await db.images.get(id);
    if (!rec) return null;
    let blob = rec.blob;
    if (!blob && rec.driveFileId && validToken() && navigator.onLine) {
      try {
        blob = await downloadBlob(rec.driveFileId);
        await db.images.update(id, { blob });
      } catch {
        return null;
      }
    }
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** 使われていない、作成から1日以上経った未アップロード画像を端末から消す */
export async function gcImages(referenced: Set<string>) {
  const dayAgo = Date.now() - 86_400_000;
  const all = await db.images.toArray();
  const remove = all.filter((r) => !referenced.has(r.id) && !r.driveFileId && r.createdAt < dayAgo).map((r) => r.id);
  if (remove.length) await db.images.bulkDelete(remove);
}
