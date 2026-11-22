import type { CardEvent, CardState, Status } from '../types';

export const MASTER_STREAK = 2;

export function initialState(): CardState {
  return {
    status: 'learning',
    streak: 0,
    lastTestedAt: null,
    answers: 0,
    correct: 0,
    partial: 0,
    wrong: 0,
    recent: [],
    lastAnsweredAt: null,
  };
}

export function sortEvents<T extends CardEvent>(events: readonly T[]): T[] {
  return events.slice().sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 1件のイベントを状態に適用する（破壊的）。
 * ルール:
 *  - テスト／暗記中: ○で連続+1、2連続で暗記済み。△・×で連続0
 *  - テスト／暗記済み: ×で暗記中に戻す。○・△は変化なし
 *  - 暗記モード: 記録のみ
 *  - 手動変更: その状態にして連続0
 */
export function applyEvent(s: CardState, e: CardEvent): void {
  if (e.kind === 'status') {
    s.status = e.status;
    s.streak = 0;
    return;
  }
  s.answers++;
  if (e.grade === 2) s.correct++;
  else if (e.grade === 1) s.partial++;
  else s.wrong++;
  s.recent.push(e.grade);
  if (s.recent.length > 5) s.recent.shift();
  s.lastAnsweredAt = e.ts;

  if (e.mode !== 'test') return;
  s.lastTestedAt = e.ts;
  if (s.status === 'learning') {
    if (e.grade === 2) {
      s.streak++;
      if (s.streak >= MASTER_STREAK) {
        s.status = 'mastered';
        s.streak = 0;
      }
    } else {
      s.streak = 0;
    }
  } else if (e.grade === 0) {
    s.status = 'learning';
    s.streak = 0;
  }
}

export function deriveState(events: readonly CardEvent[]): CardState {
  const s = initialState();
  for (const e of sortEvents(events)) applyEvent(s, e);
  return s;
}

/** 状態の移り変わり（統計用）。最初は作成時点の「暗記中」 */
export function statusTimeline(createdAt: number, events: readonly CardEvent[]): { ts: number; status: Status }[] {
  const s = initialState();
  const out: { ts: number; status: Status }[] = [{ ts: createdAt, status: 'learning' }];
  for (const e of sortEvents(events)) {
    const before = s.status;
    applyEvent(s, e);
    if (s.status !== before) out.push({ ts: e.ts, status: s.status });
  }
  return out;
}

/** 正答率（○の割合）。回答がなければ null */
export function accuracy(s: CardState): number | null {
  return s.answers ? s.correct / s.answers : null;
}
