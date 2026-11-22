import { activeCards, getState, version } from '../../data';
import { navigate } from '../router';
import { startMemorize } from '../session';

export function Home() {
  void version.value;
  const cards = activeCards();
  let learning = 0;
  for (const c of cards) if (getState(c.id).status === 'learning') learning++;
  const mastered = cards.length - learning;

  return (
    <div>
      <div class="counts">
        <div class="count-tile">
          <div class="num" style="color:var(--learning)">{learning}</div>
          <div class="lbl">暗記中</div>
        </div>
        <div class="count-tile">
          <div class="num" style="color:var(--mastered)">{mastered}</div>
          <div class="lbl">暗記済み</div>
        </div>
      </div>

      {cards.length === 0 ? (
        <div class="panel center stack">
          <p>まだカードがありません。</p>
          <div class="row" style="justify-content:center">
            <a class="btn primary" href="#/edit/new">
              カードを作成
            </a>
            <a class="btn" href="#/import">
              CSVで一括登録
            </a>
          </div>
        </div>
      ) : (
        <div class="big-actions">
          <button class="big-action primary" onClick={() => startMemorize({ tag: null })} disabled={learning === 0}>
            <span class="label">暗記モード</span>
            <span class="desc">暗記中のカード（{learning}枚）をランダムに出題</span>
          </button>
          <button class="big-action" onClick={() => navigate('/memorize/tag')} disabled={learning === 0}>
            <span class="label">タグで暗記</span>
            <span class="desc">タグを1つ選んで、そのカードだけを出題</span>
          </button>
          <button class="big-action" onClick={() => navigate('/test')}>
            <span class="label">テストモード</span>
            <span class="desc">暗記中と暗記済みを混ぜて出題し、定着を確認</span>
          </button>
        </div>
      )}
    </div>
  );
}
