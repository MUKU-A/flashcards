import { useCallback, useEffect, useState } from 'preact/hooks';
import { getCard, getState, recordAnswer, removeEvents, setStatus, version } from '../../data';
import type { Grade } from '../../types';
import { StudyCard } from '../components/StudyCard';
import { navigate } from '../router';
import { eligibleForMemorize, memorize } from '../session';
import { showToast } from '../toast';

export function MemorizeRun() {
  void version.value;
  const s = memorize.value;
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!s) navigate('/', true);
  }, [s]);

  const advance = useCallback(() => {
    if (!s) return;
    const next = s.queue.next(eligibleForMemorize);
    memorize.value = { ...s, current: next, step: s.step + 1 };
  }, [s]);

  const onGrade = useCallback(
    (g: Grade) => {
      if (!s?.current) return;
      void recordAnswer(s.current, 'memorize', g);
      s.counts[g]++;
      advance();
    },
    [s, advance],
  );

  const onMaster = useCallback(async () => {
    if (!s?.current) return;
    const ids = await setStatus([s.current], 'mastered');
    const next = s.queue.next(eligibleForMemorize);
    memorize.value = { ...s, current: next, step: s.step + 1, masteredByButton: s.masteredByButton + 1 };
    showToast('暗記済みにしました', '元に戻す', () => {
      void removeEvents(ids);
      const cur = memorize.value;
      if (cur) memorize.value = { ...cur, masteredByButton: cur.masteredByButton - 1 };
    });
  }, [s]);

  if (!s) return null;
  const card = s.current ? getCard(s.current) : undefined;
  const answered = s.counts[0] + s.counts[1] + s.counts[2];

  if (finished || !card) {
    return (
      <div class="study">
        <h1>{s.title}</h1>
        <div class="panel stack">
          {!card && !finished && <p>出題できる暗記中のカードがなくなりました。</p>}
          <div class="result-nums">
            <div>
              <div class="n" style="color:var(--bad)">{s.counts[0]}</div>×
            </div>
            <div>
              <div class="n" style="color:var(--mid)">{s.counts[1]}</div>△
            </div>
            <div>
              <div class="n" style="color:var(--good)">{s.counts[2]}</div>○
            </div>
          </div>
          <p class="center muted">
            回答 {answered}問・「暗記済みへ」にしたカード {s.masteredByButton}枚
          </p>
        </div>
        <button
          class="btn primary block"
          onClick={() => {
            memorize.value = null;
            navigate('/');
          }}
        >
          ホームへ
        </button>
      </div>
    );
  }

  return (
    <div class="study">
      <div class="study-head">
        <strong>{s.title}</strong>
        <span class="muted">{answered + 1}問目</span>
        <span class="spacer" />
        <button class="btn small" onClick={() => setFinished(true)}>
          終了
        </button>
      </div>
      <StudyCard key={`${card.id}-${s.step}`} card={card} state={getState(card.id)} onGrade={onGrade} onMaster={onMaster} />
    </div>
  );
}
