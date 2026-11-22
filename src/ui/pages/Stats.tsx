import { useMemo, useState } from 'preact/hooks';
import { activeCards, allEventsByCard, allTags, getState, version } from '../../data';
import { statusSeries, testAccuracySeries } from '../../logic/stats';
import { accuracy } from '../../logic/state';
import type { CardEvent } from '../../types';
import { LineChart } from '../components/LineChart';
import { navigate } from '../router';

export function Stats() {
  const v = version.value;
  const [tag, setTag] = useState('');
  const [days, setDays] = useState(30);

  const data = useMemo(() => {
    const cards = activeCards().filter((c) => (tag ? c.tags.includes(tag) : true));
    const byCard = allEventsByCard();
    const events: CardEvent[] = [];
    for (const c of cards) events.push(...(byCard.get(c.id) ?? []));
    const status = statusSeries(cards, byCard, days);
    const acc = testAccuracySeries(events, days);
    let learning = 0;
    for (const c of cards) if (getState(c.id).status === 'learning') learning++;
    const testTotal = acc.reduce((a, p) => a + p.total, 0);
    const testCorrect = acc.reduce((a, p) => a + p.correct, 0);
    const weak = cards
      .map((c) => ({ c, s: getState(c.id) }))
      .filter((x) => x.s.wrong > 0)
      .sort((a, b) => b.s.wrong - a.s.wrong || (accuracy(a.s) ?? 0) - (accuracy(b.s) ?? 0))
      .slice(0, 20);
    return { cards, status, acc, learning, testTotal, testCorrect, weak };
  }, [v, tag, days]);

  return (
    <div>
      <h1>統計</h1>
      <div class="row" style="margin-bottom:12px">
        <select style="flex:1;min-width:160px" value={tag} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
          <option value="">すべてのカード</option>
          {allTags().map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}（{t.count}）
            </option>
          ))}
        </select>
        {[30, 90].map((d) => (
          <button key={d} class={`btn small ${days === d ? 'selected' : ''}`} onClick={() => setDays(d)}>
            {d}日
          </button>
        ))}
      </div>

      <div class="counts" style="grid-template-columns:repeat(3,1fr)">
        <div class="count-tile">
          <div class="num">{data.learning}</div>
          <div class="lbl">暗記中</div>
        </div>
        <div class="count-tile">
          <div class="num">{data.cards.length - data.learning}</div>
          <div class="lbl">暗記済み</div>
        </div>
        <div class="count-tile">
          <div class="num">{data.testTotal ? `${Math.round((data.testCorrect / data.testTotal) * 100)}%` : '—'}</div>
          <div class="lbl">テスト正答率（{days}日）</div>
        </div>
      </div>

      <div class="panel">
        <h2>暗記中・暗記済みの枚数</h2>
        <LineChart
          ariaLabel="暗記中と暗記済みの枚数の推移"
          labels={data.status.map((p) => p.date)}
          series={[
            { name: '暗記中', color: 'var(--series-a)', values: data.status.map((p) => p.learning) },
            { name: '暗記済み', color: 'var(--series-b)', values: data.status.map((p) => p.mastered) },
          ]}
          format={(n) => `${Math.round(n)}`}
        />
      </div>

      <div class="panel">
        <h2>テストの正答率（○の割合）</h2>
        {data.testTotal === 0 ? (
          <p class="muted small">この期間にテストモードの回答はありません。</p>
        ) : (
          <LineChart
            ariaLabel="日ごとのテスト正答率"
            labels={data.acc.map((p) => p.date)}
            series={[
              {
                name: '正答率',
                color: 'var(--series-b)',
                values: data.acc.map((p) => (p.total ? Math.round((p.correct / p.total) * 100) : null)),
              },
            ]}
            yMax={100}
            format={(n) => `${Math.round(n)}%`}
            extra={(i) => {
              const p = data.acc[i];
              return p.total ? `回答${p.total}問（×${p.wrong} △${p.partial} ○${p.correct}）` : null;
            }}
          />
        )}
      </div>

      <div class="panel">
        <h2>苦手なカード（×が多い順）</h2>
        {data.weak.length === 0 ? (
          <p class="muted small">×のついたカードはありません。</p>
        ) : (
          <ul class="card-list">
            {data.weak.map(({ c, s }) => (
              <li key={c.id}>
                <div class="body" onClick={() => navigate(`/edit/${c.id}`)}>
                  <div class="q">{c.question.text.split('\n')[0] || '（画像）'}</div>
                  <div class="meta muted">
                    ×{s.wrong}回・△{s.partial}回・○{s.correct}回（正答率 {Math.round((accuracy(s) ?? 0) * 100)}%）
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
