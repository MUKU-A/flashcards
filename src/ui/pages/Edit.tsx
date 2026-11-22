import { useEffect, useRef, useState } from 'preact/hooks';
import { createCards, deleteCards, emptyField, getCard, getState, setStatus, updateCard, type CardDraft } from '../../data';
import { settings } from '../../settings';
import type { Field, Status } from '../../types';
import { formatDateTime } from '../../util';
import { FieldEditor } from '../components/FieldEditor';
import { TagInput } from '../components/TagInput';
import { navigate } from '../router';
import { showToast } from '../toast';

const blank = (tags: string[] = []): CardDraft => ({
  question: emptyField(),
  hint: emptyField(),
  answer: emptyField(),
  memo: emptyField(),
  tags,
});

const filled = (f: Field) => !!f.text.trim() || f.images.length > 0;
const trimField = (f: Field): Field => ({ text: f.text.replace(/\s+$/, ''), images: f.images });

let lastTags: string[] = [];

export function Edit({ id }: { id: string }) {
  const isNew = id === 'new';
  const existing = isNew ? undefined : getCard(id);
  const [draft, setDraft] = useState<CardDraft>(() =>
    existing
      ? { question: existing.question, hint: existing.hint, answer: existing.answer, memo: existing.memo, tags: existing.tags }
      : blank(settings.value.inheritTags ? lastTags : []),
  );
  const initialStatus = existing ? getState(existing.id).status : 'learning';
  const [status, setStatusLocal] = useState<Status>(initialStatus);
  const [formKey, setFormKey] = useState(0);
  const [tried, setTried] = useState(false);
  const qRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isNew && !existing) navigate('/manage', true);
  }, [isNew, existing]);

  const set = (k: keyof CardDraft) => (v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = filled(draft.question) && filled(draft.answer);

  const save = async () => {
    setTried(true);
    if (!valid) return;
    const clean: CardDraft = {
      question: trimField(draft.question),
      hint: trimField(draft.hint),
      answer: trimField(draft.answer),
      memo: trimField(draft.memo),
      tags: draft.tags,
    };
    if (isNew) {
      await createCards([clean]);
      lastTags = clean.tags;
      showToast('保存しました');
      setDraft(blank(settings.value.inheritTags ? clean.tags : []));
      setTried(false);
      setFormKey((k) => k + 1);
      setTimeout(() => qRef.current?.focus(), 0);
    } else {
      await updateCard(id, clean);
      if (status !== initialStatus) await setStatus([id], status);
      showToast('保存しました');
      history.length > 1 ? history.back() : navigate('/manage');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isNew && !existing) return null;

  return (
    <div>
      <div class="row" style="margin-bottom:12px">
        <h1 style="margin:0">{isNew ? '新規作成' : 'カードの編集'}</h1>
        <span class="spacer" />
        <a class="btn small ghost" href="#/manage">
          閉じる
        </a>
      </div>

      <div class="stack" key={formKey}>
        <FieldEditor
          label="問題"
          required
          value={draft.question}
          onChange={set('question')}
          autoFocus={isNew}
          textareaRef={(el) => (qRef.current = el)}
        />
        <FieldEditor label="ヒント" value={draft.hint} onChange={set('hint')} rows={2} />
        <FieldEditor label="解答" required value={draft.answer} onChange={set('answer')} />
        <FieldEditor label="メモ" value={draft.memo} onChange={set('memo')} rows={2} />

        <div class="field-editor">
          <label class="field-label">
            タグ<span class="muted small" style="margin-left:4px">任意・複数可</span>
          </label>
          <TagInput value={draft.tags} onChange={set('tags')} />
        </div>

        {!isNew && (
          <div class="field-editor">
            <label class="field-label">状態</label>
            <div class="row">
              {(['learning', 'mastered'] as Status[]).map((s) => (
                <button key={s} class={`btn small ${status === s ? 'selected' : ''}`} onClick={() => setStatusLocal(s)}>
                  {s === 'learning' ? '暗記中' : '暗記済み'}
                </button>
              ))}
            </div>
            <p class="muted small" style="margin:8px 0 0">
              作成 {formatDateTime(existing!.createdAt)}・最後にテスト {formatDateTime(getState(id).lastTestedAt)}・回答{' '}
              {getState(id).answers}回
            </p>
          </div>
        )}

        {tried && !valid && <p class="error-text small">問題と解答は必須です（テキストか画像のどちらか）。</p>}

        <div class="row">
          <button class="btn primary" style="min-width:140px" onClick={save}>
            {isNew ? '保存して次へ' : '保存'}
          </button>
          <span class="muted small kbd-hint">
            <kbd>⌘</kbd>+<kbd>Enter</kbd>
          </span>
          <span class="spacer" />
          {!isNew && (
            <button
              class="btn danger"
              onClick={async () => {
                if (!confirm('このカードを削除しますか？')) return;
                await deleteCards([id]);
                showToast('削除しました');
                navigate('/manage', true);
              }}
            >
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
