import Dexie, { type Table } from 'dexie';
import type { Card, ImageRec, StoredEvent } from './types';

export type MetaRow = { key: string; value: unknown };

class FlashcardsDB extends Dexie {
  cards!: Table<Card, string>;
  events!: Table<StoredEvent, string>;
  images!: Table<ImageRec, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('flashcards');
    this.version(1).stores({
      cards: 'id, updatedAt',
      events: 'id, cardId, file',
      images: 'id',
      meta: 'key',
    });
  }
}

export const db = new FlashcardsDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
