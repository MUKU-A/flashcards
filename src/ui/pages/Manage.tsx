import { useMemo, useState } from 'preact/hooks';
import {
  activeCards,
  addTagToCards,
  allTags,
  deleteCards,
  getState,
  removeTagFromCards,
  setStatus,
  version,
} from '../../data';
import { accuracy } from '../../logic/state';
import type { Card, Status } from '../../types';
import { GRADE_LABEL, STATUS_LABEL } from '../../types';
import { navigate } from '../router';
import { showToast } from '../toast';
import { TagInput } from '../components/TagInput';

type Sort = 'created-desc' | 'created-asc' | 'updated-desc' | 'acc-asc' | 'acc-desc' | 'tested-asc';
const SORT_LABEL: Record<Sort, string> = {
  'created-desc': '作成日（新しい順）',
  'created-asc': '作成日（古い順）',
  'updated-desc': '更新日（新しい順）',
  'acc-asc': '正答率（低い順）',
  'acc-desc': '正答率（高い順）',
  'tested-asc': '最後にテストした日（古い順）',
};

const PAGE = 100;

function preview(c: Card) {
  const t = c.question.text.trim().split('\n')[0];
  return t || (c.question.images.length ? '（画像）' : '（空）');
}

export function Manage() {
  const v = version.value;
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatusFilter] = useState<'' | Status>('');
  const [sort, setSort] = useState<Sort>('created-desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [removeTag, setRemoveTag] = useState('');

  const list = useMemo(() => {
    const needle = q.normalize('NFKC').toLowerCase().trim();
    const out = activeCards().filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (status && getState(c.id).status !== status) return false;
      if (needle) {
        const hay = [c.question.text, c.hint.text, c.answer.text, c.memo.text].join('\n').normalize('NFKC').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const acc = (c: Card) => accuracy(getState(c.id));
    const cmpNullLast = (a: number | null, b: number | null, dir: 1 | -1) =>
      a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir;
    out.sort((a, b) => {
      switch (sort) {
        case 'created-desc':
          return b.createdAt - a.createdAt;
        case 'created-asc':
          return a.createdAt - b.createdAt;
        case 'updated-desc':
          return b.updatedAt - a.updatedAt;
        case 'acc-asc':
          return cmpNullLast(acc(a), acc(b), 1);
        case 'acc-desc':
          return cmpNullLast(acc(a), acc(b), -1);
        case 'tested-asc':
          return (getState(a.id).lastTestedAt ?? -Infinity) - (getState(b.id).lastTestedAt ?? -Infinity);
      }
    });
    return out;
  }, [v, q, tag, status, sort]);

  const sel = [...selected].filter((id) => list.some((c) => c.id === id));
  const allChecked = list.length > 0 && sel.length === list.length;
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };
  const selTags = [...new Set(list.filter((c) => selected.has(c.id)).flatMap((c) => c.tags))];

  return (
    <div>
      <div class="row" style="margin-bottom:12px">
        <h1 style="margin:0">カード</h1>
        <span class="muted small">{list.length}枚</span>
        <span class="spacer" />
        <a class="btn small" href="#/import">
          一括登録
        </a>
        <a class="btn small primary" href="#/edit/new">
          ＋ 新規作成
        </a>
      </div>

      <div class="filters">
        <input type="search" placeholder="キーワードで検索" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <select value={tag} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
          <option value="">すべてのタグ</option>
          {allTags().map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}（{t.count}）
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as '' | Status)}>
          <option value="">すべての状態</option>
          <option value="learning">暗記中</option>
          <option value="mastered">暗記済み</option>
        </select>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as Sort)}>
          {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      {sel.length > 0 && (
        <div class="bulk-bar stack">
          <div class="row">
            <strong>{sel.length}枚を選択中</strong>
            <span class="spacer" />
            <button class="btn small ghost" onClick={() => setSelected(new Set())}>
              選択解除
            </button>
          </div>
          <div class="row" style="align-items:flex-start">
            <div style="flex:1;min-width:200px">
              <TagInput value={bulkTags} onChange={setBulkTags} placeholder="追加するタグ" />
            </div>
            <button
              class="btn small"
              disabled={!bulkTags.length}
              onClick={async () => {
                for (const t of bulkTags) await addTagToCards(sel, t);
                setBulkTags([]);
                showToast('タグを追加しました');
              }}
            >
              タグを追加
            </button>
          </div>
          {selTags.length > 0 && (
            <div class="row">
              <select style="flex:1;min-width:160px" value={removeTag} onChange={(e) => setRemoveTag((e.target as HTMLSelectElement).value)}>
                <option value="">外すタグを選択</option>
                {selTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                class="btn small"
                disabled={!removeTag}
                onClick={async () => {
                  await removeTagFromCards(sel, removeTag);
                  setRemoveTag('');
                  showToast('タグを外しました');
                }}
              >
                タグを外す
              </button>
            </div>
          )}
          <div class="row">
            <button
              class="btn small"
              onClick={async () => {
                const n = (await setStatus(sel, 'learning')).length;
                showToast(`${n}枚を暗記中にしました`);
              }}
            >
              暗記中にする
            </button>
            <button
              class="btn small"
              onClick={async () => {
                const n = (await setStatus(sel, 'mastered')).length;
                showToast(`${n}枚を暗記済みにしました`);
              }}
            >
              暗記済みにする
            </button>
            <span class="spacer" />
            <button
              class="btn small danger"
              onClick={async () => {
                if (!confirm(`${sel.length}枚のカードを削除しますか？`)) return;
                await deleteCards(sel);
                setSelected(new Set());
                showToast('削除しました');
              }}
            >
              削除
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div class="panel muted center">該当するカードがありません</div>
      ) : (
        <>
          <label class="switch small" style="margin:0 0 8px 12px">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setSelected(allChecked ? new Set() : new Set(list.map((c) => c.id)))}
            />
            表示中をすべて選択
          </label>
          <ul class="card-list">
            {list.slice(0, limit).map((c) => {
              const st = getState(c.id);
              return (
                <li key={c.id}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="選択" />
                  <div class="body" onClick={() => navigate(`/edit/${c.id}`)}>
                    <div class="q">{preview(c)}</div>
                    <div class="meta">
                      <span class={`badge ${st.status}`}>{STATUS_LABEL[st.status]}</span>
                      {c.tags.map((t) => (
                        <span class="chip" key={t}>
                          {t}
                        </span>
                      ))}
                      {st.recent.length > 0 && (
                        <span class="recent">
                          {st.recent.map((g, i) => (
                            <span key={i} class={`g${g}`}>
                              {GRADE_LABEL[g]}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {list.length > limit && (
            <button class="btn block" style="margin-top:12px" onClick={() => setLimit(limit + PAGE)}>
              さらに表示（残り{list.length - limit}枚）
            </button>
          )}
        </>
      )}
    </div>
  );
}
