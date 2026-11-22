/**
 * Google Drive との同期。
 *  マイドライブ/Flashcards/
 *    cards.json                  … カード（更新日時が新しい方を採用して統合）と画像の対応表
 *    events-<端末ID>-<年月>.json  … 正誤・状態変更の履歴（書き込むのはその端末だけ）
 *    images/<画像ID>.jpg
 */
import { computed, signal } from '@preact/signals';
import { db, getMeta, setMeta } from '../db';
import {
  allCardsIncludingDeleted,
  allReferencedImageIds,
  clearDirty,
  dirty,
  getDeviceId,
  getDirtyGen,
  markCardsDirty,
  mergeRemoteCards,
  ownEventsForFile,
  replaceRemoteEventFile,
  setChangeListener,
} from '../data';
import { DRIVE_FOLDER_NAME, DRIVE_IMAGES_FOLDER_NAME } from '../config';
import type { Card, CardEvent } from '../types';
import { imagesVersion } from '../images';
import { isConfigured, token, validToken, setEmail, email } from './auth';
import {
  AuthRequiredError,
  createFile,
  downloadBlob,
  downloadJson,
  fetchEmail,
  findOrCreateFolder,
  folderExists,
  jsonBlob,
  listChildren,
  putFile,
} from './drive';

type Remote = {
  folderId?: string;
  imagesFolderId?: string;
  cardsFileId?: string;
  cardsModified?: string;
  files: Record<string, { id: string; modifiedTime: string }>;
};

type CardsFile = {
  version: 1;
  updatedAt: number;
  cards: Card[];
  images: Record<string, { driveFileId: string; mime: string }>;
};

type EventsFile = { version: 1; deviceId: string; file: string; events: CardEvent[] };

export const syncing = signal(false);
export const syncError = signal('');
export const lastSyncAt = signal<number | null>(null);
export const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
const tick = signal(0); // トークンの期限切れを表示に反映するため

export type SyncIndicator = 'local-only' | 'offline' | 'login' | 'syncing' | 'error' | 'pending' | 'synced';

export const indicator = computed<SyncIndicator>(() => {
  void tick.value;
  void token.value;
  if (!isConfigured()) return 'local-only';
  if (syncing.value) return 'syncing';
  if (!online.value) return 'offline';
  if (!validToken()) return 'login';
  if (syncError.value) return 'error';
  const d = dirty.value;
  if (d.cards || d.files.length) return 'pending';
  return 'synced';
});

let timer: ReturnType<typeof setTimeout> | undefined;
let rerun = false;

/** 変更後に少し待ってから自動同期（ログイン済み・オンライン時のみ） */
export function scheduleSync(delay = 4000) {
  if (!isConfigured()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (online.value && validToken()) void syncNow();
  }, delay);
}

export function initSync() {
  setChangeListener(() => scheduleSync());
  getMeta<number | null>('lastSyncAt', null).then((v) => (lastSyncAt.value = v));
  window.addEventListener('online', () => {
    online.value = true;
    scheduleSync(500);
  });
  window.addEventListener('offline', () => (online.value = false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500);
  });
  setInterval(() => tick.value++, 30_000);
  scheduleSync(300);
}

export async function syncNow(): Promise<void> {
  if (!isConfigured() || !validToken()) return;
  if (syncing.value) {
    rerun = true;
    return;
  }
  syncing.value = true;
  syncError.value = '';
  try {
    do {
      rerun = false;
      await runSync();
    } while (rerun);
    const now = Date.now();
    lastSyncAt.value = now;
    await setMeta('lastSyncAt', now);
    void prefetchImages();
  } catch (e) {
    syncError.value = e instanceof AuthRequiredError ? '' : e instanceof Error ? e.message : String(e);
    if (!(e instanceof AuthRequiredError)) console.error(e);
  } finally {
    syncing.value = false;
  }
}

async function runSync() {
  const remote = await getMeta<Remote>('remote', { files: {} });
  const own = getDeviceId();

  if (!email.value) fetchEmail().then(setEmail, () => {});

  // フォルダの用意（消されていたら作り直す）
  if (!remote.folderId || !(await folderExists(remote.folderId))) {
    remote.folderId = await findOrCreateFolder(DRIVE_FOLDER_NAME, 'root');
    remote.imagesFolderId = undefined;
    remote.cardsFileId = undefined;
    remote.cardsModified = undefined;
    remote.files = {};
  }
  if (!remote.imagesFolderId) {
    remote.imagesFolderId = await findOrCreateFolder(DRIVE_IMAGES_FOLDER_NAME, remote.folderId);
  }
  const folderId = remote.folderId;
  const list = await listChildren(folderId);

  // ① カード：Drive 側が更新されていれば取り込む
  const cardsFile = list.find((f) => f.name === 'cards.json');
  if (cardsFile) {
    remote.cardsFileId = cardsFile.id;
    if (cardsFile.modifiedTime !== remote.cardsModified) {
      const json = await downloadJson<CardsFile>(cardsFile.id);
      await mergeImageMeta(json.images ?? {});
      const localNewer = await mergeRemoteCards(json.cards ?? []);
      if (localNewer) await markCardsDirty();
      remote.cardsModified = cardsFile.modifiedTime;
    }
  } else {
    remote.cardsFileId = undefined;
    if (allCardsIncludingDeleted().length) await markCardsDirty();
  }

  // ② 履歴：他の端末のファイルで更新されたものを取り込む
  const seen = new Set<string>();
  for (const f of list) {
    const m = /^events-(.+)\.json$/.exec(f.name);
    if (!m) continue;
    seen.add(f.name);
    const key = m[1];
    if (key.startsWith(`${own}-`)) {
      remote.files[f.name] = { id: f.id, modifiedTime: f.modifiedTime };
      continue;
    }
    if (remote.files[f.name]?.modifiedTime === f.modifiedTime) continue;
    const json = await downloadJson<EventsFile>(f.id);
    await replaceRemoteEventFile(key, json.events ?? []);
    remote.files[f.name] = { id: f.id, modifiedTime: f.modifiedTime };
  }
  for (const name of Object.keys(remote.files)) if (!seen.has(name)) delete remote.files[name];
  await setMeta('remote', remote);

  // ③ 画像：未アップロードのものを送る
  const referenced = allReferencedImageIds();
  const pending = (await db.images.toArray()).filter((r) => !r.driveFileId && r.blob && referenced.has(r.id));
  for (const img of pending) {
    const ext = img.mime === 'image/png' ? 'png' : img.mime === 'image/webp' ? 'webp' : 'jpg';
    const res = await createFile(`${img.id}.${ext}`, remote.imagesFolderId, img.blob!);
    await db.images.update(img.id, { driveFileId: res.id });
  }
  if (pending.length) await markCardsDirty();

  // ④ カードを送る
  if (dirty.value.cards) {
    const gen = getDirtyGen();
    const images: CardsFile['images'] = {};
    for (const r of await db.images.toArray()) if (r.driveFileId) images[r.id] = { driveFileId: r.driveFileId, mime: r.mime };
    const body: CardsFile = { version: 1, updatedAt: Date.now(), cards: allCardsIncludingDeleted(), images };
    const res = await putFile(remote.cardsFileId, 'cards.json', folderId, jsonBlob(body));
    remote.cardsFileId = res.id;
    remote.cardsModified = res.modifiedTime;
    await setMeta('remote', remote);
    if (getDirtyGen() === gen) await clearDirty({ cards: true });
    else rerun = true;
  }

  // ⑤ 自分の履歴ファイルを送る
  for (const file of [...dirty.value.files]) {
    const gen = getDirtyGen();
    const name = `events-${file}.json`;
    const events = ownEventsForFile(file).map(({ file: _f, ...e }) => e as CardEvent);
    const body: EventsFile = { version: 1, deviceId: own, file, events };
    const res = await putFile(remote.files[name]?.id, name, folderId, jsonBlob(body));
    remote.files[name] = { id: res.id, modifiedTime: res.modifiedTime };
    await setMeta('remote', remote);
    if (getDirtyGen() === gen) await clearDirty({ files: [file] });
    else rerun = true;
  }
}

async function mergeImageMeta(images: CardsFile['images']) {
  const ids = Object.keys(images);
  if (!ids.length) return;
  const existing = await db.images.bulkGet(ids);
  const puts = [];
  for (let i = 0; i < ids.length; i++) {
    const cur = existing[i];
    const meta = images[ids[i]];
    if (!cur) puts.push({ id: ids[i], mime: meta.mime, driveFileId: meta.driveFileId, createdAt: Date.now() });
    else if (!cur.driveFileId) puts.push({ ...cur, driveFileId: meta.driveFileId });
  }
  if (puts.length) await db.images.bulkPut(puts);
}

/** オフラインでも表示できるよう、未取得の画像を端末に取ってくる */
async function prefetchImages() {
  const referenced = allReferencedImageIds();
  const missing = (await db.images.toArray()).filter((r) => !r.blob && r.driveFileId && referenced.has(r.id));
  let got = 0;
  const worker = async () => {
    while (missing.length) {
      const r = missing.pop()!;
      try {
        const blob = await downloadBlob(r.driveFileId!);
        await db.images.update(r.id, { blob });
        got++;
      } catch {
        /* 次回の同期で再試行 */
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (got) imagesVersion.value++;
}
