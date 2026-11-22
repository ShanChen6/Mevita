import { toSearchText } from '../common/vietnamese.js';

export interface Icd10Row {
  code: string;
  nameVi: string;
  nameEn: string | null;
  chapter: string | null;
  searchText: string;
}

/** Dấu phân tách xuất hiện nhiều nhất ở dòng đầu (Excel tiếng Việt thường xuất ";"). */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  // Khi hoà, ưu tiên ";" và tab vì dấu phẩy hay xuất hiện ngay trong nội dung
  const [best] = ([';', '\t', ','] as const)
    .map((d) => ({ d, n: firstLine.split(d).length - 1 }))
    .sort((a, b) => b.n - a.n);
  return best && best.n > 0 ? best.d : ',';
}

/** Đọc CSV theo RFC 4180 (hỗ trợ dấu phân tách và xuống dòng trong ô có ngoặc kép). */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Bỏ ký tự BOM (U+FEFF) ở đầu file do Excel thêm vào
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Tên cột chấp nhận (không phân biệt hoa thường, có/không dấu) — để nhập được file của Bộ Y tế. */
const HEADER_ALIASES: Record<keyof Omit<Icd10Row, 'searchText'>, string[]> = {
  code: ['code', 'ma', 'ma benh', 'ma icd', 'ma icd10', 'ma icd 10', 'icd', 'icd10'],
  nameVi: [
    'name vi',
    'name_vi',
    'ten',
    'ten benh',
    'ten tieng viet',
    'ten benh tieng viet',
    'vietnamese',
  ],
  nameEn: ['name en', 'name_en', 'ten tieng anh', 'ten benh tieng anh', 'english', 'title'],
  chapter: ['chapter', 'chuong', 'ma chuong'],
};

const normHeader = (h: string) => toSearchText(h).replace(/_/g, ' ').replace(/\./g, '').trim();
const CODE_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

/**
 * Chuyển bảng CSV thành danh sách mã ICD-10 hợp lệ.
 * Bắt buộc cột mã và tên tiếng Việt; bỏ qua dòng mã sai định dạng (VD dòng tiêu đề chương "A00-A09").
 */
export function toIcd10Rows(table: string[][]): { rows: Icd10Row[]; skipped: number } {
  const [header, ...body] = table;
  if (!header) throw new Error('File rỗng');
  const index = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      header.findIndex((h) => aliases.includes(normHeader(h).replace(/_/g, ' '))),
    ]),
  ) as Record<keyof typeof HEADER_ALIASES, number>;
  if (index.code < 0 || index.nameVi < 0) {
    throw new Error(
      `Không tìm thấy cột mã và tên tiếng Việt. Tiêu đề hiện có: ${header.join(' | ')}`,
    );
  }

  const seen = new Map<string, Icd10Row>();
  let skipped = 0;
  for (const cells of body) {
    let code = (cells[index.code] ?? '').trim().toUpperCase().replace(/\s/g, '');
    // Một số bảng ghi mã 4 ký tự không có dấu chấm, VD "S065"
    if (/^[A-Z]\d{3,4}$/.test(code)) code = `${code.slice(0, 3)}.${code.slice(3)}`;
    const nameVi = (cells[index.nameVi] ?? '').trim();
    if (!CODE_RE.test(code) || !nameVi) {
      skipped++;
      continue;
    }
    const nameEn = index.nameEn >= 0 ? (cells[index.nameEn] ?? '').trim() || null : null;
    const chapter = index.chapter >= 0 ? (cells[index.chapter] ?? '').trim() || null : null;
    seen.set(code, {
      code,
      nameVi,
      nameEn,
      chapter,
      searchText: toSearchText(`${code} ${nameVi} ${nameEn ?? ''}`),
    });
  }
  return { rows: [...seen.values()], skipped };
}
