import { useCallback, useEffect } from 'preact/hooks';
import { getCard, getState, recordAnswer, removeEvents, setStatus, version } from '../../data';
import type { Grade } from '../../types';
import { StudyCard } from '../components/StudyCard';
import { navigate } from '../router';
import { test } from '../session';
import { showToast } from '../toast';

export function TestRun() {
  void version.value;
  const s = test.value;

  useEffect(() => {
    if (!s) navigate('/', true);
  }, [s]);

  // 削除されたカードは飛ばす
  useEffect(() => {
    if (!s || s.index >= s.ids.length) return;
    if (!getCard(s.ids[s.index])) test.value = { ...s, index: s.index + 1 };
  }, [s]);

  const finish = useCallback(() => navigate('/test/result', true), []);

  useEffect(() => {
    if (s && s.index >= s.ids.length) finish();
  }, [s, finish]);

  const onGrade = useCallback(
    (g: Grade) => {
      if (!s) return;
      const id = s.ids[s.index];
      void recordAnswer(id, 'test', g);
      test.value = { ...s, results: { ...s.results, [id]: g }, index: s.index + 1 };
    },
    [s],
  );

  const onMaster = useCallback(async () => {
    if (!s) return;
    const ids = await setStatus([s.ids[s.index]], 'mastered');
    test.value = { ...s, index: s.index + 1 };
    showToast('暗記済みにしました', '元に戻す', () => void removeEvents(ids));
  }, [s]);

  if (!s || s.index >= s.ids.length) return null;
  const card = getCard(s.ids[s.index]);
  if (!card) return null;

  return (
    <div class="study">
      <div class="study-head">
        <strong>{s.title}</strong>
        <span class="muted" style="font-variant-numeric:tabular-nums">
          {s.index + 1} / {s.ids.length}
        </span>
        <div class="progress">
          <div style={{ width: `${(s.index / s.ids.length) * 100}%` }} />
        </div>
        <button
          class="btn small"
          onClick={() => {
            if (confirm('テストを終了しますか？ここまでの回答は記録されています。')) finish();
          }}
        >
          終了
        </button>
      </div>
      {s.index === 0 && s.shortage && <p class="muted small" style="margin:0 0 8px">{s.shortage}</p>}
      <StudyCard key={`${card.id}-${s.index}`} card={card} state={getState(card.id)} onGrade={onGrade} onMaster={onMaster} />
    </div>
  );
}
