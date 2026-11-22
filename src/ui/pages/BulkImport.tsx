import { useMemo, useState } from 'preact/hooks';
import { createCards } from '../../data';
import { parseDelimited, rowsToDrafts } from '../../logic/csv';
import { TagInput } from '../components/TagInput';
import { navigate } from '../router';
import { showToast } from '../toast';

const SAMPLE = `問題\tヒント\t解答\tメモ\tタグ
HTTPSの標準ポート番号は？\t\t443\t\tIT;ネットワーク
OSI参照モデルの第3層は？\tルーティングを担う\tネットワーク層\t\tIT;ネットワーク`;

export function BulkImport() {
  const [text, setText] = useState('');
  const [commonTags, setCommonTags] = useState<string[]>([]);
  const result = useMemo(() => rowsToDrafts(parseDelimited(text)), [text]);

  return (
    <div>
      <h1>一括登録</h1>
      <div class="panel stack small">
        <p style="margin:0">
          スプレッドシートからコピーした内容（TSV）か CSV を貼り付けてください。列の順番は
          <strong>「問題・ヒント・解答・メモ・タグ」</strong>です。
        </p>
        <ul style="margin:0;padding-left:1.2em">
          <li>1行目が「問題」で始まる場合は見出し行として読み飛ばします</li>
          <li>タグが複数ある場合は「;」で区切ります（例：IT;ネットワーク）</li>
          <li>画像は登録後に各カードの編集画面から追加してください</li>
        </ul>
        <button class="btn small" style="align-self:flex-start" onClick={() => setText(SAMPLE)}>
          例を入れてみる
        </button>
      </div>

      <div class="stack">
        <textarea
          rows={10}
          placeholder="ここに貼り付け"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          style="font-family:ui-monospace,monospace;font-size:0.85rem"
        />
        <div>
          <label class="field-label">すべてのカードにつけるタグ（任意）</label>
          <TagInput value={commonTags} onChange={setCommonTags} />
        </div>

        {text.trim() && (
          <div class="panel">
            <p style="margin-top:0">
              <strong>{result.drafts.length}件</strong>を登録できます
              {result.errors.length > 0 && <span class="error-text">（{result.errors.length}行は登録されません）</span>}
            </p>
            {result.errors.length > 0 && (
              <ul class="small error-text">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.line}>
                    {e.line}行目：{e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.drafts.length > 0 && (
              <div style="overflow-x:auto">
                <table class="preview">
                  <thead>
                    <tr>
                      <th>問題</th>
                      <th>ヒント</th>
                      <th>解答</th>
                      <th>メモ</th>
                      <th>タグ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.drafts.slice(0, 5).map((d, i) => (
                      <tr key={i}>
                        <td>{d.question}</td>
                        <td>{d.hint}</td>
                        <td>{d.answer}</td>
                        <td>{d.memo}</td>
                        <td>{d.tags.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.drafts.length > 5 && <p class="muted small">ほか{result.drafts.length - 5}件</p>}
              </div>
            )}
          </div>
        )}

        <button
          class="btn primary block"
          disabled={!result.drafts.length}
          onClick={async () => {
            const field = (t: string) => ({ text: t, images: [] });
            await createCards(
              result.drafts.map((d) => ({
                question: field(d.question),
                hint: field(d.hint),
                answer: field(d.answer),
                memo: field(d.memo),
                tags: [...d.tags, ...commonTags],
              })),
            );
            showToast(`${result.drafts.length}件を登録しました`);
            navigate('/manage');
          }}
        >
          {result.drafts.length}件を登録
        </button>
      </div>
    </div>
  );
}
