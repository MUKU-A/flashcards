import { shuffle, type Rng } from '../util';

export type Candidate = { id: string; lastTestedAt: number | null };

export type TestPlan = {
  ids: string[];
  learningCount: number;
  masteredCount: number;
  requested: number;
};

/** 枠のうち「最後にテストしてから長く経ったカード」で埋める割合（3割・切り上げ） */
export const STALE_NUM = 3;
export const STALE_DEN = 10;

export function staleCount(k: number): number {
  return k > 0 ? Math.ceil((k * STALE_NUM) / STALE_DEN) : 0;
}

/**
 * テストの出題枠の配分を決める。
 * learningPct: 暗記中の割合（0〜100 の整数, 例: 70 → 7:3）。端数は暗記中に寄せる。
 * どちらかが足りなければもう一方で埋める。
 */
export function allocate(requested: number, learningPct: number, L: number, M: number) {
  const total = Math.max(0, Math.min(requested, L + M));
  let nl = Math.ceil((total * learningPct) / 100);
  let nm = total - nl;
  if (nl > L) {
    nm += nl - L;
    nl = L;
  }
  if (nm > M) {
    nl += nm - M;
    nm = M;
  }
  return { total, nl, nm };
}

/**
 * グループから k 枚選ぶ。
 *  - 3割（切り上げ）は最後にテストしてから長く経った順（未テストが最優先、同順位はランダム）
 *  - 残りは完全ランダム
 */
export function pickFromGroup(group: readonly Candidate[], k: number, rng: Rng = Math.random): string[] {
  if (k <= 0) return [];
  if (k >= group.length) return group.map((c) => c.id);
  const stale = staleCount(k);
  // 先にシャッフルしてから安定ソートすることで、同順位をランダムにする
  const byAge = shuffle(group, rng).sort((a, b) => {
    const ta = a.lastTestedAt ?? -Infinity;
    const tb = b.lastTestedAt ?? -Infinity;
    return ta === tb ? 0 : ta < tb ? -1 : 1;
  });
  const chosen = byAge.slice(0, stale);
  const rest = shuffle(byAge.slice(stale), rng).slice(0, k - stale);
  return [...chosen, ...rest].map((c) => c.id);
}

export function buildTest(
  learning: readonly Candidate[],
  mastered: readonly Candidate[],
  requested: number,
  learningPct: number,
  rng: Rng = Math.random,
): TestPlan {
  const { nl, nm } = allocate(requested, learningPct, learning.length, mastered.length);
  const ids = shuffle([...pickFromGroup(learning, nl, rng), ...pickFromGroup(mastered, nm, rng)], rng);
  return { ids, learningCount: nl, masteredCount: nm, requested };
}
