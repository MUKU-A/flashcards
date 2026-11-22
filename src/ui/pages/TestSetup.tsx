import { useState } from 'preact/hooks';
import { activeCards, allTags, getState, version } from '../../data';
import { allocate } from '../../logic/test-builder';
import { startTest } from '../session';

const PRESETS = [100, 200, 300];
const DEFAULT_PCT = 70;

export function TestSetup() {
  void version.value;
  const [tag, setTag] = useState<string>('');
  const [count, setCount] = useState(100);
  const [pct, setPct] = useState(DEFAULT_PCT);

  const scope = activeCards().filter((c) => (tag ? c.tags.includes(tag) : true));
  let L = 0;
  for (const c of scope) if (getState(c.id).status === 'learning') L++;
  const M = scope.length - L;
  const plan = allocate(count, pct, L, M);
  const valid = Number.isFinite(count) && count > 0 && plan.total > 0;

  return (
    <div>
      <h1>テストモード</h1>

      <div class="panel stack">
        <div>
          <label class="field-label">出題範囲</label>
          <select value={tag} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
            <option value="">すべてのカード</option>
            {allTags().map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}（{t.count}枚）
              </option>
            ))}
          </select>
          <p class="muted small" style="margin:6px 0 0">
            暗記中 {L}枚・暗記済み {M}枚
          </p>
        </div>

        <div>
          <label class="field-label">出題数</label>
          <div class="row">
            {PRESETS.map((n) => (
              <button key={n} class={`btn ${count === n ? 'selected' : ''}`} onClick={() => setCount(n)}>
                {n}問
              </button>
            ))}
            <input
              type="number"
              min={1}
              inputMode="numeric"
              style="width:110px"
              value={count}
              onInput={(e) => setCount(Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value))))}
            />
            <span>問</span>
          </div>
        </div>

        <div>
          <label class="field-label">暗記中 : 暗記済み の比率</label>
          <div class="range-row">
            <span class="small muted">暗記中</span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={pct}
              onInput={(e) => setPct(Number((e.target as HTMLInputElement).value))}
            />
            <span class="small muted">暗記済み</span>
            <span class="ratio-label">
              {pct / 10} : {10 - pct / 10}
            </span>
          </div>
          {pct !== DEFAULT_PCT && (
            <button class="btn small ghost" onClick={() => setPct(DEFAULT_PCT)}>
              7:3 に戻す
            </button>
          )}
        </div>

        <div class="small">
          {valid ? (
            <>
              <strong>
                暗記中 {plan.nl}問・暗記済み {plan.nm}問
              </strong>
              {plan.total < count && <div class="muted">全{plan.total}枚のため{plan.total}問で開始します</div>}
            </>
          ) : (
            <span class="muted">出題できるカードがありません</span>
          )}
        </div>
      </div>

      <button
        class="btn primary block"
        style="min-height:52px"
        disabled={!valid}
        onClick={() => startTest({ tag: tag || null, count, learningPct: pct })}
      >
        テストを開始
      </button>
    </div>
  );
}
