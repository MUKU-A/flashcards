/** CSV / TSV の解析（ダブルクォート対応）。区切りは1行目にタブがあればタブ、なければカンマ */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n');
  const firstLine = src.split('\n', 1)[0] ?? '';
  const delim = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') inQuotes = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export type ImportDraft = { question: string; hint: string; answer: string; memo: string; tags: string[] };
export type ImportResult = { drafts: ImportDraft[]; errors: { line: number; message: string }[] };

/** 列: 問題, ヒント, 解答, メモ, タグ（; 区切り） */
export function rowsToDrafts(rows: string[][]): ImportResult {
  const drafts: ImportDraft[] = [];
  const errors: { line: number; message: string }[] = [];
  rows.forEach((r, i) => {
    if (i === 0 && (r[0] ?? '').trim() === '問題') return; // 見出し行
    const [question = '', hint = '', answer = '', memo = '', tags = ''] = r.map((c) => c.trim());
    if (!question || !answer) {
      errors.push({ line: i + 1, message: !question ? '問題が空です' : '解答が空です' });
      return;
    }
    drafts.push({
      question,
      hint,
      answer,
      memo,
      tags: tags
        .split(/[;；]/)
        .map((t) => t.trim())
        .filter(Boolean),
    });
  });
  return { drafts, errors };
}
