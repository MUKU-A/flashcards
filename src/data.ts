/**
 * アプリ全体のデータ（IndexedDB の内容をメモリに展開したもの）と、その操作。
 * 画面は `version` シグナルを読むことで、データ変更時に再描画される。
 */
import { signal } from '@preact/signals';
import { db, getMeta, setMeta } from './db';
import { deriveState, initialState } from './logic/state';
import type { Card, CardEvent, CardState, Field, Grade, Mode, Status, StoredEvent } from './types';
import { monthKey, normTag, resolveTag, uniqueTags, uuid } from './util';

export const version = signal(0);
export const ready = signal(false);

const cards = new Map<string, Card>();
const eventsByCard = new Map<string, StoredEvent[]>();
const states = new Map<string, CardState>();
let deviceId = '';

/** 変更をDriveへ送る必要があるか（同期モジュールが参照） */
export const dirty = signal({ cards: false, files: [] as string[] });

let onChange: () => void = () => {};
/** データが変わったときに呼ばれる（同期の予約に使う） */
export function setChangeListener(fn: () => void) {
  onChange = fn;
}

function bump(local = true) {
  version.value++;
  if (local) onChange();
}

export function getDeviceId() {
  return deviceId;
}

export async function loadAll() {
  deviceId = await getMeta<string>('deviceId', '');
  if (!deviceId) {
    deviceId = uuid().slice(0, 8);
    await setMeta('deviceId', deviceId);
  }
  dirty.value = await getMeta('dirty', { cards: false, files: [] as string[] });
  cards.clear();
  eventsByCard.clear();
  states.clear();
  for (const c of await db.cards.toArray()) cards.set(c.id, c);
  for (const e of await db.events.toArray()) {
    const arr = eventsByCard.get(e.cardId);
    if (arr) arr.push(e);
    else eventsByCard.set(e.cardId, [e]);
  }
  for (const id of cards.keys()) recompute(id);
  ready.value = true;
  bump(false);
}

function recompute(cardId: string) {
  states.set(cardId, deriveState(eventsByCard.get(cardId) ?? []));
}

let dirtyGen = 0;
/** 変更が起きるたびに増える番号。同期中に別の変更が入ったかの判定に使う */
export const getDirtyGen = () => dirtyGen;

export async function markCardsDirty() {
  await markDirty({ cards: true });
}

async function markDirty(part: { cards?: boolean; file?: string }) {
  dirtyGen++;
  const d = { ...dirty.value, files: [...dirty.value.files] };
  if (part.cards) d.cards = true;
  if (part.file && !d.files.includes(part.file)) d.files.push(part.file);
  dirty.value = d;
  await setMeta('dirty', d);
}

export async function clearDirty(part: { cards?: boolean; files?: string[] }) {
  const d = {
    cards: part.cards ? false : dirty.value.cards,
    files: dirty.value.files.filter((f) => !(part.files ?? []).includes(f)),
  };
  dirty.value = d;
  await setMeta('dirty', d);
}

// ───────── 読み取り ─────────

export function getCard(id: string): Card | undefined {
  const c = cards.get(id);
  return c && !c.deleted ? c : undefined;
}

export function activeCards(): Card[] {
  const out: Card[] = [];
  for (const c of cards.values()) if (!c.deleted) out.push(c);
  return out;
}

export function allCardsIncludingDeleted(): Card[] {
  return [...cards.values()];
}

export function getState(id: string): CardState {
  return states.get(id) ?? initialState();
}

export function getEvents(id: string): readonly StoredEvent[] {
  return eventsByCard.get(id) ?? [];
}

export function allEventsByCard(): ReadonlyMap<string, readonly CardEvent[]> {
  return eventsByCard;
}

export function* allEvents(): Generator<StoredEvent> {
  for (const arr of eventsByCard.values()) yield* arr;
}

export function ownEventsForFile(file: string): StoredEvent[] {
  const out: StoredEvent[] = [];
  for (const arr of eventsByCard.values()) for (const e of arr) if (e.file === file) out.push(e);
  return out.sort((a, b) => a.ts - b.ts);
}

let tagCache: { v: number; list: { name: string; count: number }[] } | null = null;
/** 使われているタグ（枚数の多い順） */
export function allTags(): { name: string; count: number }[] {
  if (tagCache && tagCache.v === version.peek()) return tagCache.list;
  const counts = new Map<string, number>();
  for (const c of cards.values()) {
    if (c.deleted) continue;
    for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const list = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
  tagCache = { v: version.peek(), list };
  return list;
}

export function cardsWithTag(tag: string | null): Card[] {
  const all = activeCards();
  return tag ? all.filter((c) => c.tags.includes(tag)) : all;
}

// ───────── カードの作成・更新・削除 ─────────

export const emptyField = (): Field => ({ text: '', images: [] });

export type CardDraft = Pick<Card, 'question' | 'hint' | 'answer' | 'memo' | 'tags'>;

function cleanTags(tags: string[]): string[] {
  const existing = allTags().map((t) => t.name);
  return uniqueTags(tags.map((t) => resolveTag(t, existing)).filter((t) => normTag(t) !== ''));
}

export async function createCards(drafts: CardDraft[]): Promise<Card[]> {
  const now = Date.now();
  const created = drafts.map((d, i) => ({
    id: uuid(),
    ...d,
    tags: cleanTags(d.tags),
    createdAt: now + i, // 一括登録時も作成順を保つ
    updatedAt: now + i,
    deleted: false,
  }));
  await db.cards.bulkPut(created);
  for (const c of created) {
    cards.set(c.id, c);
    recompute(c.id);
  }
  await markDirty({ cards: true });
  bump();
  return created;
}

export async function updateCard(id: string, draft: CardDraft): Promise<void> {
  const c = cards.get(id);
  if (!c) return;
  const next: Card = { ...c, ...draft, tags: cleanTags(draft.tags), updatedAt: Date.now() };
  await db.cards.put(next);
  cards.set(id, next);
  await markDirty({ cards: true });
  bump();
}

async function updateMany(ids: string[], fn: (c: Card) => Card | null) {
  const now = Date.now();
  const changed: Card[] = [];
  for (const id of ids) {
    const c = cards.get(id);
    if (!c) continue;
    const n = fn(c);
    if (n) changed.push({ ...n, updatedAt: now });
  }
  if (!changed.length) return;
  await db.cards.bulkPut(changed);
  for (const c of changed) cards.set(c.id, c);
  await markDirty({ cards: true });
  bump();
}

export async function deleteCards(ids: string[]) {
  await updateMany(ids, (c) => ({ ...c, deleted: true }));
}

export async function addTagToCards(ids: string[], tag: string) {
  const name = resolveTag(tag, allTags().map((t) => t.name));
  if (!name) return;
  await updateMany(ids, (c) => (c.tags.includes(name) ? null : { ...c, tags: [...c.tags, name] }));
}

export async function removeTagFromCards(ids: string[], tag: string) {
  await updateMany(ids, (c) => (c.tags.includes(tag) ? { ...c, tags: c.tags.filter((t) => t !== tag) } : null));
}

/** 名前の変更・統合（to が既存タグなら統合になる） */
export async function renameTag(from: string, to: string) {
  const name = to.normalize('NFKC').trim();
  if (!name || name === from) return;
  const target = allTags().find((t) => t.name !== from && normTag(t.name) === normTag(name))?.name ?? name;
  const ids = activeCards()
    .filter((c) => c.tags.includes(from))
    .map((c) => c.id);
  await updateMany(ids, (c) => ({ ...c, tags: uniqueTags(c.tags.map((t) => (t === from ? target : t))) }));
}

export async function deleteTag(tag: string) {
  const ids = activeCards()
    .filter((c) => c.tags.includes(tag))
    .map((c) => c.id);
  await removeTagFromCards(ids, tag);
}

// ───────── 回答・状態変更（イベント） ─────────

async function addEvents(evs: CardEvent[]) {
  const stored: StoredEvent[] = evs.map((e) => ({ ...e, file: `${deviceId}-${monthKey(e.ts)}` }));
  await db.events.bulkPut(stored);
  const files = new Set<string>();
  for (const e of stored) {
    const arr = eventsByCard.get(e.cardId);
    if (arr) arr.push(e);
    else eventsByCard.set(e.cardId, [e]);
    files.add(e.file);
  }
  for (const id of new Set(stored.map((e) => e.cardId))) recompute(id);
  for (const f of files) await markDirty({ file: f });
  bump();
}

export async function recordAnswer(cardId: string, mode: Mode, grade: Grade): Promise<string> {
  const id = uuid();
  await addEvents([{ id, cardId, ts: Date.now(), deviceId, kind: 'answer', mode, grade }]);
  return id;
}

export async function setStatus(cardIds: string[], status: Status): Promise<string[]> {
  const now = Date.now();
  const evs: CardEvent[] = cardIds
    .filter((id) => getState(id).status !== status)
    .map((cardId) => ({ id: uuid(), cardId, ts: now, deviceId, kind: 'status', status }));
  if (evs.length) await addEvents(evs);
  return evs.map((e) => e.id);
}

/** 直前の操作の取り消し（自分の端末のイベントのみ） */
export async function removeEvents(ids: string[]) {
  const evs = (await db.events.bulkGet(ids)).filter((e): e is StoredEvent => !!e && e.deviceId === deviceId);
  if (!evs.length) return;
  await db.events.bulkDelete(evs.map((e) => e.id));
  for (const e of evs) {
    const arr = eventsByCard.get(e.cardId);
    if (arr) eventsByCard.set(e.cardId, arr.filter((x) => x.id !== e.id));
    recompute(e.cardId);
    await markDirty({ file: e.file });
  }
  bump();
}

// ───────── 同期モジュールからの反映 ─────────

/** Drive から取得したカードを統合（更新日時が新しい方を採用）。ローカルの方が新しいものが残れば true */
export async function mergeRemoteCards(remote: Card[]): Promise<boolean> {
  const toPut: Card[] = [];
  let localNewer = false;
  const remoteIds = new Set<string>();
  for (const r of remote) {
    remoteIds.add(r.id);
    const l = cards.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) toPut.push(r);
    else if (l.updatedAt > r.updatedAt) localNewer = true;
  }
  for (const l of cards.values()) if (!remoteIds.has(l.id)) localNewer = true;
  if (toPut.length) {
    await db.cards.bulkPut(toPut);
    for (const c of toPut) {
      cards.set(c.id, c);
      if (!states.has(c.id)) recompute(c.id);
    }
    bump(false);
  }
  return localNewer;
}

/** 他の端末のイベントファイルの内容で、そのファイル分を置き換える */
export async function replaceRemoteEventFile(file: string, events: CardEvent[]) {
  const old = await db.events.where('file').equals(file).toArray();
  const stored: StoredEvent[] = events.map((e) => ({ ...e, file }));
  await db.transaction('rw', db.events, async () => {
    await db.events.bulkDelete(old.map((e) => e.id));
    await db.events.bulkPut(stored);
  });
  const touched = new Set<string>();
  for (const e of old) {
    const arr = eventsByCard.get(e.cardId);
    if (arr) eventsByCard.set(e.cardId, arr.filter((x) => x.file !== file));
    touched.add(e.cardId);
  }
  for (const e of stored) {
    const arr = eventsByCard.get(e.cardId);
    if (arr) arr.push(e);
    else eventsByCard.set(e.cardId, [e]);
    touched.add(e.cardId);
  }
  for (const id of touched) recompute(id);
  bump(false);
}

export function allReferencedImageIds(): Set<string> {
  const ids = new Set<string>();
  for (const c of cards.values()) {
    if (c.deleted) continue;
    for (const f of [c.question, c.hint, c.answer, c.memo]) for (const i of f.images) ids.add(i);
  }
  return ids;
}
