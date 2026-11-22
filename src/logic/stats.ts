import type { Card, CardEvent, Status } from '../types';
import { dateKey } from '../util';
import { statusTimeline } from './state';

export type DayPoint = { date: string; learning: number; mastered: number };
export type AccuracyPoint = { date: string; total: number; correct: number; partial: number; wrong: number };

function dayEnds(days: number, now = Date.now()): { key: string; end: number }[] {
  const out: { key: string; end: number }[] = [];
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ key: dateKey(d.getTime()), end: d.getTime() });
  }
  return out;
}

/** 日ごとの暗記中・暗記済みの枚数（各日の終わり時点） */
export function statusSeries(
  cards: readonly Card[],
  eventsByCard: ReadonlyMap<string, readonly CardEvent[]>,
  days: number,
  now = Date.now(),
): DayPoint[] {
  const ends = dayEnds(days, now);
  const points = ends.map((d) => ({ date: d.key, learning: 0, mastered: 0 }));
  for (const c of cards) {
    const tl = statusTimeline(c.createdAt, eventsByCard.get(c.id) ?? []);
    let j = 0;
    let cur: Status | null = null;
    ends.forEach((d, i) => {
      while (j < tl.length && tl[j].ts <= d.end) cur = tl[j++].status;
      if (cur) points[i][cur]++;
    });
  }
  return points;
}

/** 日ごとのテストモードの正答 */
export function testAccuracySeries(events: Iterable<CardEvent>, days: number, now = Date.now()): AccuracyPoint[] {
  const ends = dayEnds(days, now);
  const map = new Map(ends.map((d) => [d.key, { date: d.key, total: 0, correct: 0, partial: 0, wrong: 0 }]));
  for (const e of events) {
    if (e.kind !== 'answer' || e.mode !== 'test') continue;
    const p = map.get(dateKey(e.ts));
    if (!p) continue;
    p.total++;
    if (e.grade === 2) p.correct++;
    else if (e.grade === 1) p.partial++;
    else p.wrong++;
  }
  return ends.map((d) => map.get(d.key)!);
}
