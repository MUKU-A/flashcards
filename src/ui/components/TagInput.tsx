import { useMemo, useRef, useState } from 'preact/hooks';
import { allTags, version } from '../../data';
import { normTag, resolveTag } from '../../util';

type Props = { value: string[]; onChange: (tags: string[]) => void; placeholder?: string };

/** タグ入力。既存タグを使用頻度順に候補表示し、打った文字で絞り込む。候補にない文字は Enter で新規作成 */
export function TagInput({ value, onChange, placeholder = 'タグを追加' }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const v = version.value;

  const existing = useMemo(() => allTags(), [v]);
  const chosen = new Set(value.map(normTag));
  const q = normTag(text);
  const suggestions = existing.filter((t) => !chosen.has(normTag(t.name)) && (!q || normTag(t.name).includes(q)));
  const exact = existing.some((t) => normTag(t.name) === q);
  const showCreate = q !== '' && !exact && !chosen.has(q);
  const items: { label: string; name: string; count?: number; create?: boolean }[] = [
    ...suggestions.slice(0, 50).map((t) => ({ label: t.name, name: t.name, count: t.count })),
    ...(showCreate ? [{ label: `「${text.trim()}」を新しいタグとして追加`, name: text, create: true }] : []),
  ];

  const add = (name: string) => {
    const resolved = resolveTag(name, existing.map((t) => t.name));
    if (resolved && !chosen.has(normTag(resolved))) onChange([...value, resolved]);
    setText('');
    setActive(0);
    setOpen(false); // 候補一覧が保存ボタンなどに被らないよう、追加したら閉じる（入力・クリックで再表示）
    inputRef.current?.focus();
  };

  return (
    <div class="tag-input">
      <div class="box" onClick={() => inputRef.current?.focus()}>
        {value.map((t) => (
          <span class="chip" key={t}>
            {t}
            <button type="button" aria-label={`${t}を外す`} onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={text}
          placeholder={value.length ? '' : placeholder}
          onInput={(e) => {
            setText((e.target as HTMLInputElement).value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            // 日本語変換中の Enter は確定操作なので無視する
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (open && items[active] && (q === '' || items[active].create || normTag(items[active].name).includes(q)))
                add(items[active].name);
              else if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && text === '' && value.length) {
              onChange(value.slice(0, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && items.length > 0 && (
        <div class="suggest" onMouseDown={(e) => e.preventDefault()}>
          {items.map((it, i) => (
            <button type="button" key={it.label} class={i === active ? 'active' : ''} onClick={() => add(it.name)}>
              <span>{it.label}</span>
              {it.count !== undefined && <span class="muted small">{it.count}枚</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
