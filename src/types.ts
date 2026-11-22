export type Field = { text: string; images: string[] };

export type FieldKey = 'question' | 'hint' | 'answer' | 'memo';

export type Card = {
  id: string;
  question: Field;
  hint: Field;
  answer: Field;
  memo: Field;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
};

/** 0: ×, 1: △, 2: ○ */
export type Grade = 0 | 1 | 2;
export type Status = 'learning' | 'mastered';
export type Mode = 'memorize' | 'test';

type EventBase = {
  id: string;
  cardId: string;
  ts: number;
  deviceId: string;
};

export type AnswerEvent = EventBase & { kind: 'answer'; mode: Mode; grade: Grade };
/** 「暗記済みへ」ボタンや管理画面からの手動の状態変更 */
export type StatusEvent = EventBase & { kind: 'status'; status: Status };
export type CardEvent = AnswerEvent | StatusEvent;

/** IndexedDB に保存する形（どの Drive ファイルに属するか付き） */
export type StoredEvent = CardEvent & { file: string };

export type CardState = {
  status: Status;
  /** テストモードでの連続○の回数（暗記中のときだけ意味を持つ） */
  streak: number;
  /** テストモードで最後に回答した日時。未テストなら null */
  lastTestedAt: number | null;
  answers: number;
  correct: number;
  partial: number;
  wrong: number;
  /** 直近の回答（古い→新しい、最大5件） */
  recent: Grade[];
  lastAnsweredAt: number | null;
};

export type ImageRec = {
  id: string;
  mime: string;
  blob?: Blob;
  driveFileId?: string;
  createdAt: number;
};

export const GRADE_LABEL: Record<Grade, string> = { 0: '×', 1: '△', 2: '○' };
export const STATUS_LABEL: Record<Status, string> = { learning: '暗記中', mastered: '暗記済み' };
export const FIELD_LABEL: Record<FieldKey, string> = {
  question: '問題',
  hint: 'ヒント',
  answer: '解答',
  memo: 'メモ',
};
export const FIELD_KEYS: FieldKey[] = ['question', 'hint', 'answer', 'memo'];
