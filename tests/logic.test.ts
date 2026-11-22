import { describe, it, expect } from 'vitest';
import { deriveState, statusTimeline } from '../src/logic/state';
import { allocate, buildTest, pickFromGroup, staleCount, type Candidate } from '../src/logic/test-builder';
import { MemorizeQueue } from '../src/logic/memorize';
import { parseDelimited, rowsToDrafts } from '../src/logic/csv';
import { resolveTag } from '../src/util';
import type { CardEvent, Grade } from '../src/types';

let n = 0;
const ans = (grade: Grade, mode: 'test' | 'memorize' = 'test'): CardEvent => ({
  id: `e${++n}`, cardId: 'c', ts: ++n, deviceId: 'd', kind: 'answer', mode, grade,
});
const st = (status: 'learning' | 'mastered'): CardEvent => ({ id: `e${++n}`, cardId: 'c', ts: ++n, deviceId: 'd', kind: 'status', status });

// 再現性のある乱数
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('状態の導出', () => {
  it('テストで2連続○なら暗記済み', () => {
    expect(deriveState([ans(2), ans(2)]).status).toBe('mastered');
  });
  it('△・×で連続がリセットされる', () => {
    expect(deriveState([ans(2), ans(1), ans(2)]).status).toBe('learning');
    expect(deriveState([ans(2), ans(0), ans(2), ans(2)]).status).toBe('mastered');
  });
  it('暗記モードの回答は状態に影響しない', () => {
    const s = deriveState([ans(2, 'memorize'), ans(2, 'memorize'), ans(2, 'memorize')]);
    expect(s.status).toBe('learning');
    expect(s.lastTestedAt).toBeNull();
    expect(s.answers).toBe(3);
  });
  it('暗記モードの回答は連続○を途切れさせない', () => {
    expect(deriveState([ans(2), ans(0, 'memorize'), ans(2)]).status).toBe('mastered');
  });
  it('暗記済みで×なら暗記中に戻る、△は変化なし', () => {
    expect(deriveState([ans(2), ans(2), ans(1)]).status).toBe('mastered');
    const s = deriveState([ans(2), ans(2), ans(0)]);
    expect(s.status).toBe('learning');
    expect(s.streak).toBe(0);
  });
  it('暗記済みから戻った後は再び2連続○が必要', () => {
    expect(deriveState([ans(2), ans(2), ans(0), ans(2)]).status).toBe('learning');
    expect(deriveState([ans(2), ans(2), ans(0), ans(2), ans(2)]).status).toBe('mastered');
  });
  it('手動変更（暗記済みへ）', () => {
    expect(deriveState([ans(2), st('mastered')]).status).toBe('mastered');
    expect(deriveState([st('mastered'), st('learning'), ans(2)]).status).toBe('learning');
  });
  it('順不同で届いたイベントも時刻順に処理', () => {
    const a = ans(2), b = ans(2), c = ans(0);
    expect(deriveState([c, b, a]).status).toBe('learning');
  });
  it('状態の推移', () => {
    const tl = statusTimeline(0, [ans(2), ans(2), ans(0)]);
    expect(tl.map((t) => t.status)).toEqual(['learning', 'mastered', 'learning']);
  });
});

describe('テストの組み立て', () => {
  it('7:3で端数は暗記中へ', () => {
    expect(allocate(100, 70, 1000, 1000)).toEqual({ total: 100, nl: 70, nm: 30 });
    expect(allocate(15, 70, 1000, 1000)).toEqual({ total: 15, nl: 11, nm: 4 });
    expect(allocate(10, 70, 1000, 1000)).toEqual({ total: 10, nl: 7, nm: 3 });
  });
  it('足りない側はもう一方で埋める', () => {
    expect(allocate(100, 70, 20, 1000)).toEqual({ total: 100, nl: 20, nm: 80 });
    expect(allocate(100, 70, 1000, 5)).toEqual({ total: 100, nl: 95, nm: 5 });
    expect(allocate(100, 70, 30, 20)).toEqual({ total: 50, nl: 30, nm: 20 });
  });
  it('比率0や100も扱える', () => {
    expect(allocate(10, 0, 50, 50)).toEqual({ total: 10, nl: 0, nm: 10 });
    expect(allocate(10, 100, 50, 50)).toEqual({ total: 10, nl: 10, nm: 0 });
  });
  it('3割は切り上げ', () => {
    expect(staleCount(1)).toBe(1);
    expect(staleCount(3)).toBe(1);
    expect(staleCount(4)).toBe(2);
    expect(staleCount(70)).toBe(21);
    expect(staleCount(0)).toBe(0);
  });
  it('長く経ったカードが必ず含まれる（未テスト最優先）', () => {
    const group: Candidate[] = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, lastTestedAt: 1000 + i }));
    group.push({ id: 'never', lastTestedAt: null });
    const picked = pickFromGroup(group, 10, seeded(1));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked.slice(0, 3)).toEqual(['never', 'c0', 'c1']);
  });
  it('全カードがいずれ出題される（シミュレーション）', () => {
    const rng = seeded(42);
    const L = Array.from({ length: 500 }, (_, i) => ({ id: `l${i}`, lastTestedAt: 0 as number | null }));
    const M = Array.from({ length: 300 }, (_, i) => ({ id: `m${i}`, lastTestedAt: 0 as number | null }));
    const seen = new Set<string>();
    let t = 1;
    for (let round = 0; round < 40; round++) {
      const plan = buildTest(L, M, 100, 70, rng);
      expect(plan.ids).toHaveLength(100);
      expect(plan.learningCount).toBe(70);
      for (const id of plan.ids) {
        seen.add(id);
        const c = [...L, ...M].find((x) => x.id === id)!;
        c.lastTestedAt = t++;
      }
    }
    expect(seen.size).toBe(800);
  });
});

describe('暗記キュー', () => {
  it('一巡するまで重複しない', () => {
    const q = new MemorizeQueue(['a', 'b', 'c', 'd'], seeded(3));
    const first = [q.next(() => true), q.next(() => true), q.next(() => true), q.next(() => true)];
    expect(new Set(first).size).toBe(4);
    const fifth = q.next(() => true);
    expect(fifth).not.toBe(first[3]);
  });
  it('対象外は飛ばし、全部対象外なら null', () => {
    const q = new MemorizeQueue(['a', 'b'], seeded(3));
    expect(q.next((id) => id === 'b')).toBe('b');
    expect(q.next((id) => id === 'b')).toBe('b');
    expect(q.next(() => false)).toBeNull();
  });
});

describe('CSV/TSV', () => {
  it('TSVと見出し行', () => {
    const r = rowsToDrafts(parseDelimited('問題\tヒント\t解答\tメモ\tタグ\nTCPのポート\t\t80\t\tIT;ネットワーク\n'));
    expect(r.drafts).toEqual([{ question: 'TCPのポート', hint: '', answer: '80', memo: '', tags: ['IT', 'ネットワーク'] }]);
  });
  it('CSVのクォートと改行', () => {
    const r = rowsToDrafts(parseDelimited('"a,b","h","line1\nline2",,"x；y"'));
    expect(r.drafts[0].question).toBe('a,b');
    expect(r.drafts[0].answer).toBe('line1\nline2');
    expect(r.drafts[0].tags).toEqual(['x', 'y']);
  });
  it('必須項目が空ならエラー', () => {
    const r = rowsToDrafts(parseDelimited('q,,,\n,,a,'));
    expect(r.drafts).toHaveLength(0);
    expect(r.errors).toHaveLength(2);
  });
});

describe('タグの表記揺れ', () => {
  it('全角・大小文字を既存タグに寄せる', () => {
    expect(resolveTag('ｉｔ', ['IT', 'ネットワーク'])).toBe('IT');
    expect(resolveTag(' ﾈｯﾄﾜｰｸ ', ['IT', 'ネットワーク'])).toBe('ネットワーク');
    expect(resolveTag('応用情報', ['IT'])).toBe('応用情報');
  });
});
