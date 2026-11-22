import { useState } from 'preact/hooks';
import { allTags, deleteTag, renameTag, version } from '../../data';
import { normTag } from '../../util';
import { showToast } from '../toast';

function TagRow({ name, count, others }: { name: string; count: number; others: string[] }) {
  const [mode, setMode] = useState<'' | 'rename' | 'merge'>('');
  const [newName, setNewName] = useState(name);
  const [target, setTarget] = useState('');

  const clash = others.find((o) => normTag(o) === normTag(newName));

  return (
    <li>
      <div class="row">
        <span class="chip" style="font-size:0.9rem">
          {name}
        </span>
        <span class="muted small">{count}枚</span>
        <span class="spacer" />
        <button class="btn small ghost" onClick={() => setMode(mode === 'rename' ? '' : 'rename')}>
          名前を変更
        </button>
        <button class="btn small ghost" onClick={() => setMode(mode === 'merge' ? '' : 'merge')} disabled={!others.length}>
          統合
        </button>
        <button
          class="btn small ghost"
          style="color:var(--bad)"
          onClick={async () => {
            if (!confirm(`タグ「${name}」を削除しますか？（${count}枚のカードから外れます。カードは残ります）`)) return;
            await deleteTag(name);
            showToast('タグを削除しました');
          }}
        >
          削除
        </button>
      </div>

      {mode === 'rename' && (
        <div class="row" style="margin-top:8px">
          <input type="text" style="flex:1;min-width:160px" value={newName} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} />
          <button
            class="btn small primary"
            disabled={!newName.trim() || newName.trim() === name}
            onClick={async () => {
              if (clash && !confirm(`「${clash}」は既にあります。「${name}」を「${clash}」に統合しますか？`)) return;
              await renameTag(name, newName);
              showToast(clash ? '統合しました' : '名前を変更しました');
              setMode('');
            }}
          >
            {clash ? '統合する' : '変更'}
          </button>
        </div>
      )}

      {mode === 'merge' && (
        <div class="row" style="margin-top:8px">
          <span class="small">「{name}」を</span>
          <select style="flex:1;min-width:140px" value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
            <option value="">統合先を選択</option>
            {others.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <span class="small">にまとめる</span>
          <button
            class="btn small primary"
            disabled={!target}
            onClick={async () => {
              await renameTag(name, target);
              showToast(`「${target}」に統合しました`);
              setMode('');
            }}
          >
            統合
          </button>
        </div>
      )}
    </li>
  );
}

export function Tags() {
  void version.value;
  const tags = allTags();
  return (
    <div>
      <h1>タグ</h1>
      {tags.length === 0 ? (
        <div class="panel muted">まだタグがありません。カードの作成時につけられます。</div>
      ) : (
        <div class="panel">
          <ul class="tag-list">
            {tags.map((t) => (
              <TagRow
                key={t.name}
                name={t.name}
                count={t.count}
                others={tags.filter((o) => o.name !== t.name).map((o) => o.name)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
