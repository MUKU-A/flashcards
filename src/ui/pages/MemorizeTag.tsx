import { activeCards, allTags, getState, version } from '../../data';
import { startMemorize } from '../session';

export function MemorizeTag() {
  void version.value;
  const learningByTag = new Map<string, number>();
  for (const c of activeCards()) {
    if (getState(c.id).status !== 'learning') continue;
    for (const t of c.tags) learningByTag.set(t, (learningByTag.get(t) ?? 0) + 1);
  }
  const tags = allTags().filter((t) => learningByTag.has(t.name));

  return (
    <div>
      <h1>タグで暗記</h1>
      <p class="muted small">選んだタグがついた「暗記中」のカードだけを出題します。</p>
      {tags.length === 0 ? (
        <div class="panel muted">暗記中のカードについているタグがありません。</div>
      ) : (
        <ul class="card-list">
          {tags.map((t) => (
            <li key={t.name}>
              <div class="body" onClick={() => startMemorize({ tag: t.name })}>
                <div class="q">{t.name}</div>
                <div class="meta muted">暗記中 {learningByTag.get(t.name)}枚</div>
              </div>
              <button class="btn small primary" onClick={() => startMemorize({ tag: t.name })}>
                開始
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
