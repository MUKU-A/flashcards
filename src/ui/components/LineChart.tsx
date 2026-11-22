import { useState } from 'preact/hooks';

export type Series = { name: string; color: string; values: (number | null)[] };

type Props = {
  labels: string[]; // YYYY-MM-DD
  series: Series[];
  yMax?: number;
  format?: (v: number) => string;
  /** ツールチップの追加行 */
  extra?: (i: number) => string | null;
  ariaLabel: string;
};

const W = 640;
const H = 220;
const PAD = { l: 40, r: 64, t: 12, b: 26 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 折れ線グラフ（単一の縦軸・ホバーで十字線とツールチップ・表でも確認可） */
export function LineChart({ labels, series, yMax, format = (v) => String(v), extra, ariaLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const top = yMax ?? niceMax(dataMax);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / top) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const onMove = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // 系列が少なく値が飛び飛び（正答率など）のときは点も描く
  const sparse = series.some((s) => s.values.some((v) => v === null));
  const xTicks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <div class="viz">
      {series.length > 1 && (
        <div class="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" stroke-width="1" />
            <text x={PAD.l - 6} y={y(t) + 4} text-anchor="end" font-size="11" fill="var(--axis-text)">
              {format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            font-size="11"
            fill="var(--axis-text)"
          >
            {short(labels[i])}
          </text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--axis-text)" stroke-width="1" opacity="0.5" />
        )}
        {series.map((s, si) => (
          <g key={s.name}>
            <path d={paths[si]} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            {sparse &&
              s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="var(--surface)" stroke-width="2" />
                ),
              )}
            {/* 右端に名前と最新値を直接表示 */}
            {(() => {
              let last = -1;
              s.values.forEach((v, i) => v !== null && (last = i));
              if (last < 0) return null;
              const v = s.values[last]!;
              return (
                <>
                  {!sparse && <circle cx={x(last)} cy={y(v)} r="4" fill={s.color} stroke="var(--surface)" stroke-width="2" />}
                  {series.length > 1 && (
                    <text x={x(n - 1) + 8} y={y(v) + 4} font-size="11" fill="var(--text)">
                      {s.name} {format(v)}
                    </text>
                  )}
                </>
              );
            })()}
            {hover !== null && s.values[hover] !== null && (
              <circle cx={x(hover)} cy={y(s.values[hover]!)} r="5" fill={s.color} stroke="var(--surface)" stroke-width="2" />
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          class="tip"
          style={{
            left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%`,
            top: `${(PAD.t / H) * 100}%`,
          }}
        >
          <div>
            <strong>{labels[hover].replace(/-/g, '/')}</strong>
          </div>
          {series.map((s) => (
            <div key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}：{s.values[hover] === null ? '—' : format(s.values[hover]!)}
            </div>
          ))}
          {extra?.(hover) && <div class="muted">{extra(hover)}</div>}
        </div>
      )}
      <details>
        <summary class="muted">表で見る</summary>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              {series.map((s) => (
                <th key={s.name}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels
              .map((l, i) => ({ l, i }))
              .filter(({ i }) => series.some((s) => s.values[i] !== null))
              .reverse()
              .map(({ l, i }) => (
                <tr key={l}>
                  <td>{l.replace(/-/g, '/')}</td>
                  {series.map((s) => (
                    <td key={s.name}>{s.values[i] === null ? '—' : format(s.values[i]!)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
