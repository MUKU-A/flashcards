/** 出題中のセッション（画面をまたいで保持する） */
import { signal } from '@preact/signals';
import { MemorizeQueue } from '../logic/memorize';
import { buildTest, type Candidate } from '../logic/test-builder';
import { activeCards, getCard, getState } from '../data';
import type { Grade, Status } from '../types';
import { navigate } from './router';

export type MemorizeSession = {
  kind: 'memorize';
  title: string;
  queue: MemorizeQueue;
  current: string | null;
  step: number;
  counts: [number, number, number];
  masteredByButton: number;
};

export type TestSession = {
  kind: 'test';
  title: string;
  ids: string[];
  index: number;
  results: Record<string, Grade>;
  before: Record<string, Status>;
  shortage: string;
};

export const memorize = signal<MemorizeSession | null>(null);
export const test = signal<TestSession | null>(null);

/** 暗記モードで出してよいカードか（削除されておらず暗記中） */
export function eligibleForMemorize(id: string) {
  return !!getCard(id) && getState(id).status === 'learning';
}

/** tag: null なら全体。ids を渡すとそのカードだけ（×の復習用） */
export function startMemorize(opts: { tag?: string | null; ids?: string[]; title?: string }) {
  const pool =
    opts.ids ??
    activeCards()
      .filter((c) => (opts.tag ? c.tags.includes(opts.tag) : true))
      .filter((c) => getState(c.id).status === 'learning')
      .map((c) => c.id);
  const queue = new MemorizeQueue(pool);
  const s: MemorizeSession = {
    kind: 'memorize',
    title: opts.title ?? (opts.tag ? `暗記モード：${opts.tag}` : '暗記モード'),
    queue,
    current: null,
    step: 0,
    counts: [0, 0, 0],
    masteredByButton: 0,
  };
  s.current = queue.next(eligibleForMemorize);
  memorize.value = s;
  navigate('/memorize/run');
}

export function startTest(opts: { tag: string | null; count: number; learningPct: number }) {
  const scope = activeCards().filter((c) => (opts.tag ? c.tags.includes(opts.tag) : true));
  const learning: Candidate[] = [];
  const mastered: Candidate[] = [];
  for (const c of scope) {
    const st = getState(c.id);
    (st.status === 'learning' ? learning : mastered).push({ id: c.id, lastTestedAt: st.lastTestedAt });
  }
  const plan = buildTest(learning, mastered, opts.count, opts.learningPct);
  const before: Record<string, Status> = {};
  for (const id of plan.ids) before[id] = getState(id).status;
  test.value = {
    kind: 'test',
    title: opts.tag ? `テストモード：${opts.tag}` : 'テストモード',
    ids: plan.ids,
    index: 0,
    results: {},
    before,
    shortage: plan.ids.length < opts.count ? `全${plan.ids.length}枚のため${plan.ids.length}問で開始しました` : '',
  };
  navigate('/test/run');
}
