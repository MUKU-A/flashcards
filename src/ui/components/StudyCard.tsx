import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Card, CardState, Field, Grade } from '../../types';
import { STATUS_LABEL } from '../../types';
import { ImageRow, isLightboxOpen } from './Images';

function FieldView({ field, className }: { field: Field; className?: string }) {
  return (
    <div>
      {field.text && <div class={`text-block ${className ?? ''}`}>{field.text}</div>}
      <ImageRow ids={field.images} />
    </div>
  );
}

const hasContent = (f: Field) => !!f.text.trim() || f.images.length > 0;

type Props = {
  card: Card;
  state: CardState;
  onGrade: (g: Grade) => void;
  onMaster: () => void;
};

/** 出題カード。表→タップで裏→×△○ */
export function StudyCard({ card, state, onGrade, onMaster }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  // 連打で同じカードに二重に回答しないようにする
  const done = useRef(false);
  const grade = (g: Grade) => {
    if (done.current) return;
    done.current = true;
    onGrade(g);
  };
  const master = () => {
    if (done.current) return;
    done.current = true;
    onMaster();
  };
  const learning = state.status === 'learning';
  const hasHint = hasContent(card.hint);

  // キー操作は最新の状態を ref で参照する（描画を待たずに連続入力しても取りこぼさない）
  const live = useRef({ flipped, hasHint, grade, flip: () => {}, showHint: () => {} });
  const flip = () => {
    live.current.flipped = true;
    setFlipped(true);
  };
  live.current = { flipped: live.current.flipped || flipped, hasHint, grade, flip, showHint: () => setHint(true) };

  // 描画と同時に登録する（表示された瞬間からキー入力を受け付ける）
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || isLightboxOpen()) return;
      const l = live.current;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!l.flipped) l.flip();
      } else if ((e.key === 'h' || e.key === 'H') && l.hasHint && !l.flipped) {
        l.showHint();
      } else if (l.flipped && (e.key === '1' || e.key === '2' || e.key === '3')) {
        l.grade((Number(e.key) - 1) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div
        class="study-card"
        onClick={() => {
          if (!flipped && !window.getSelection()?.toString()) flip();
        }}
      >
        <div class="row">
          <span class={`badge ${state.status}`}>{STATUS_LABEL[state.status]}</span>
          <div class="chips">
            {card.tags.map((t) => (
              <span class="chip" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div class="section-label">問題</div>
          <FieldView field={card.question} className="q-text" />
        </div>

        {!flipped && hasHint && !hint && (
          <div>
            <button
              class="btn small"
              onClick={(e) => {
                e.stopPropagation();
                setHint(true);
              }}
            >
              ヒントを見る <span class="kbd-hint"><kbd>H</kbd></span>
            </button>
          </div>
        )}
        {!flipped && hint && (
          <div class="hint-box">
            <div class="section-label">ヒント</div>
            <FieldView field={card.hint} />
          </div>
        )}

        {flipped && (
          <>
            <hr />
            <div>
              <div class="section-label">解答</div>
              <FieldView field={card.answer} className="a-text" />
            </div>
            {hasContent(card.memo) && (
              <div class="hint-box">
                <div class="section-label">メモ</div>
                <FieldView field={card.memo} />
              </div>
            )}
          </>
        )}
        {!flipped && (
          <div class="tap-hint">
            タップして答えを見る <span class="kbd-hint">（<kbd>Space</kbd>）</span>
          </div>
        )}
      </div>

      {flipped ? (
        <>
          <div class="grade-bar">
            {([0, 1, 2] as Grade[]).map((g) => (
              <button key={g} class={`grade-btn g${g}`} onClick={() => grade(g)}>
                {['×', '△', '○'][g]}
                <small class="kbd-hint">{g + 1}</small>
              </button>
            ))}
          </div>
          {learning && (
            <button class="btn block master-btn" onClick={master}>
              暗記済みへ
            </button>
          )}
        </>
      ) : (
        <button class="btn block flip-btn" onClick={flip}>
          答えを見る
        </button>
      )}
    </>
  );
}
