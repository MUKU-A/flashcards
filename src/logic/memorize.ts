import { shuffle, type Rng } from '../util';

/**
 * 暗記モードの出題キュー。
 * ランダム順に一巡するまで同じカードを出さず、一巡したら並べ直す。
 * 出す時点で対象外（暗記済みになった・削除された）カードは飛ばす。
 */
export class MemorizeQueue {
  private order: string[] = [];
  private pos = 0;
  private last: string | null = null;

  constructor(
    private readonly pool: readonly string[],
    private readonly rng: Rng = Math.random,
  ) {}

  private reshuffle() {
    this.order = shuffle(this.pool, this.rng);
    // 一巡の切れ目で同じカードが連続しないようにする
    if (this.order.length > 1 && this.order[0] === this.last) {
      [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
    }
    this.pos = 0;
  }

  next(isEligible: (id: string) => boolean): string | null {
    if (!this.pool.some(isEligible)) return null;
    for (let guard = 0; guard < this.pool.length * 2 + 2; guard++) {
      if (this.pos >= this.order.length) this.reshuffle();
      const id = this.order[this.pos++];
      if (isEligible(id)) {
        this.last = id;
        return id;
      }
    }
    return null;
  }
}
