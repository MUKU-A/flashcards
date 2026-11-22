import { useEffect } from 'preact/hooks';
import { getCard, getState, version } from '../../data';
import type { Card } from '../../types';
import { navigate } from '../router';
import { startMemorize, test } from '../session';

function CardLinks({ cards }: { cards: Card[] }) {
  if (!cards.length) return <p class="muted small">なし</p>;
  return (
    <ul class="card-list">
      {cards.map((c) => (
        <li key={c.id}>
          <div class="body" onClick={() => navigate(`/edit/${c.id}`)}>
            <div class="q">{c.question.text || '（画像）'}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TestResult() {
  void version.value;
  const s = test.value;
  useEffect(() => {
    if (!s) navigate('/', true);
  }, [s]);
  if (!s) return null;

  const touched = s.ids.slice(0, s.index);
  const counts = [0, 0, 0];
  for (const g of Object.values(s.results)) counts[g]++;
  const answered = counts[0] + counts[1] + counts[2];
  const rate = answered ? Math.round((counts[2] / answered) * 100) : 0;

  const becameMastered: Card[] = [];
  const backToLearning: Card[] = [];
  for (const id of touched) {
    const c = getCard(id);
    if (!c) continue;
    const now = getState(id).status;
    if (s.before[id] === 'learning' && now === 'mastered') becameMastered.push(c);
    if (s.before[id] === 'mastered' && now === 'learning') backToLearning.push(c);
  }
  const wrongIds = Object.entries(s.results)
    .filter(([, g]) => g === 0)
    .map(([id]) => id)
    .filter((id) => getCard(id));

  return (
    <div>
      <h1>テスト結果</h1>
      <div class="panel stack">
        <div class="center">
          <div style="font-size:2.4rem;font-weight:700;line-height:1.1">{rate}%</div>
          <div class="muted small">
            正答率（○ / 回答{answered}問{answered < s.ids.length ? `・全${s.ids.length}問中` : ''}）
          </div>
        </div>
        <div class="result-nums">
          <div>
            <div class="n" style="color:var(--bad)">{counts[0]}</div>×
          </div>
          <div>
            <div class="n" style="color:var(--mid)">{counts[1]}</div>△
          </div>
          <div>
            <div class="n" style="color:var(--good)">{counts[2]}</div>○
          </div>
        </div>
      </div>

      <div class="stack">
        <button
          class="btn primary block"
          disabled={!wrongIds.length}
          onClick={() => startMemorize({ ids: wrongIds, title: '×だったカードの復習' })}
        >
          ×だったカードを暗記モードで復習（{wrongIds.length}枚）
        </button>

        <div class="panel">
          <h2>暗記済みになったカード（{becameMastered.length}）</h2>
          <CardLinks cards={becameMastered} />
        </div>
        <div class="panel">
          <h2>暗記中に戻ったカード（{backToLearning.length}）</h2>
          <CardLinks cards={backToLearning} />
        </div>

        <button
          class="btn block"
          onClick={() => {
            test.value = null;
            navigate('/');
          }}
        >
          ホームへ
        </button>
      </div>
    </div>
  );
}
