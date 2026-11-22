import { useRef, useState } from 'preact/hooks';
import type { Field } from '../../types';
import { importImage } from '../../images';
import { Img } from './Images';
import { showToast } from '../toast';

type Props = {
  label: string;
  required?: boolean;
  value: Field;
  onChange: (f: Field) => void;
  rows?: number;
  autoFocus?: boolean;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
};

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** テキスト＋画像の入力欄。画像はボタン・ドラッグ＆ドロップ・貼り付け（⌘V）で追加 */
export function FieldEditor({ label, required, value, onChange, rows = 3, autoFocus, textareaRef }: Props) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;

  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of imgs) ids.push(await importImage(f));
      onChange({ ...latest.current, images: [...latest.current.images, ...ids] });
    } catch (e) {
      showToast('画像を読み込めませんでした');
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      class={`field-editor ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes('Files')) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void addFiles([...(e.dataTransfer?.files ?? [])]);
      }}
      onPaste={(e) => {
        const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          e.preventDefault();
          void addFiles(files);
        }
      }}
    >
      <label class="field-label">
        {label}
        {required ? <span class="req">必須</span> : <span class="muted small" style="margin-left:4px">任意</span>}
      </label>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value.text}
        autoFocus={autoFocus}
        onInput={(e) => onChange({ ...latest.current, text: (e.target as HTMLTextAreaElement).value })}
      />
      {value.images.length > 0 && (
        <div class="thumbs">
          {value.images.map((id) => (
            <div class="thumb" key={id}>
              <Img id={id} />
              <button
                type="button"
                aria-label="画像を削除"
                onClick={() => onChange({ ...latest.current, images: latest.current.images.filter((x) => x !== id) })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div class="row" style="margin-top:8px">
        <button type="button" class="btn small" onClick={() => fileRef.current?.click()} disabled={busy}>
          🖼 画像を追加
        </button>
        {coarse && (
          <button type="button" class="btn small" onClick={() => camRef.current?.click()} disabled={busy}>
            📷 カメラ
          </button>
        )}
        {busy && <span class="muted small">取り込み中…</span>}
        {!coarse && <span class="muted small">ドラッグ＆ドロップ・⌘V でも追加できます</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          void addFiles([...(input.files ?? [])]);
          input.value = '';
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          void addFiles([...(input.files ?? [])]);
          input.value = '';
        }}
      />
    </div>
  );
}
