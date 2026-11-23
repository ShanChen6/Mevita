/**
 * Sinh sơ đồ ERD (Mermaid) từ prisma/schema.prisma cho báo cáo — luôn khớp CSDL thật:
 *
 *   pnpm --filter @mevita/api erd     # ghi docs/report/erd.md
 *
 * Bảng hiển thị tên bảng thật (@@map), cột PK/FK/UK và mọi cột nghiệp vụ; quan hệ lấy từ @relation(fields:…).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(here, 'schema.prisma'), 'utf8');
const out = resolve(here, '../../../docs/report/erd.md');

interface Field {
  name: string;
  column: string;
  type: string;
  optional: boolean;
  list: boolean;
  attrs: string;
  comment?: string;
}
interface Model {
  name: string;
  table: string;
  fields: Field[];
  comment?: string;
}

const models: Model[] = [];
const enums = new Set<string>();
for (const m of schema.matchAll(/^enum (\w+) \{/gm)) enums.add(m[1]);

const blocks = schema.matchAll(/((?:^\/\/\/.*\n)*)^model (\w+) \{\n([\s\S]*?)^\}/gm);
for (const [, doc, name, body] of blocks) {
  const fields: Field[] = [];
  let pendingDoc: string | undefined;
  let table = name;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('///')) {
      pendingDoc = line.slice(3).trim();
      continue;
    }
    const map = /^@@map\("(\w+)"\)/.exec(line);
    if (map) table = map[1]!;
    const f = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*?)(?:\/\/\s*(.*))?$/.exec(line);
    if (!f || line.startsWith('@@') || line.startsWith('//')) {
      pendingDoc = undefined;
      continue;
    }
    const attrs = f[4] ?? '';
    fields.push({
      name: f[1],
      column: /@map\("(\w+)"\)/.exec(attrs)?.[1] ?? f[1],
      type: f[2],
      optional: f[3] === '?',
      list: f[3] === '[]',
      attrs,
      comment: pendingDoc ?? f[5]?.trim(),
    });
    pendingDoc = undefined;
  }
  models.push({
    name: name,
    table,
    fields,
    comment: doc?.replace(/\/\/\/\s?/g, '').trim() || undefined,
  });
}
const byName = new Map(models.map((m) => [m.name, m]));
const scalar = (f: Field) => !byName.has(f.type) && !f.list;

const fkCols = new Map<string, Set<string>>();
const rels: string[] = [];
for (const m of models) {
  for (const f of m.fields) {
    const rel = /@relation\((?:"(\w+)",\s*)?fields:\s*\[([\w,\s]+)\]/.exec(f.attrs);
    if (!rel || !byName.has(f.type)) continue;
    const cols = rel[2].split(',').map((s) => s.trim());
    fkCols.set(m.name, new Set([...(fkCols.get(m.name) ?? []), ...cols]));
    const fk = m.fields.find((x) => x.name === cols[0]);
    const unique = fk ? /@unique/.test(fk.attrs) || /@id/.test(fk.attrs) : false;
    const parent = f.optional ? '|o' : '||';
    const child = unique ? 'o|' : 'o{';
    const label = (rel[1] ?? f.name).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    rels.push(`    ${byName.get(f.type)!.table} ${parent}--${child} ${m.table} : "${label}"`);
  }
}
/** compact: chỉ cột khoá (vừa một trang báo cáo); đầy đủ: mọi cột kèm chú thích. */
function diagram(compact: boolean) {
  const lines: string[] = ['erDiagram'];
  for (const m of models) {
    lines.push(`    ${m.table} {`);
    const fks = fkCols.get(m.name) ?? new Set();
    for (const f of m.fields.filter(scalar)) {
      const keys = [
        /@id/.test(f.attrs) && 'PK',
        fks.has(f.name) && 'FK',
        /@unique/.test(f.attrs) && 'UK',
      ].filter(Boolean);
      if (compact && keys.length === 0) continue;
      const type = enums.has(f.type) ? `enum_${f.type}` : f.type.toLowerCase();
      const note = (compact ? '' : (f.comment ?? '')).replace(/"/g, "'").slice(0, 60);
      lines.push(
        `        ${type} ${f.column}${keys.length ? ` ${keys.join(', ')}` : ''}${note ? ` "${note}"` : ''}`,
      );
    }
    lines.push('    }');
  }
  lines.push(...rels);
  return lines.join('\n');
}

const tableRows = models
  .map(
    (m) =>
      `| \`${m.table}\` | ${m.name} | ${m.fields.filter(scalar).length} | ${m.comment?.split('\n')[0] ?? ''} |`,
  )
  .join('\n');

writeFileSync(
  out,
  `# Sơ đồ thực thể – liên kết (ERD)

> Tệp sinh tự động từ \`apps/api/prisma/schema.prisma\` bằng \`pnpm --filter @mevita/api erd\` — không sửa tay.
> Ký hiệu: PK khoá chính, FK khoá ngoại, UK duy nhất. \`||--o{\` một–nhiều, \`||--o|\` một–một, \`|o\` phía cha có thể rỗng.

${models.length} bảng, ${rels.length} quan hệ, ${enums.size} kiểu liệt kê.

| Bảng | Model | Số cột | Mô tả |
| --- | --- | --- | --- |
${tableRows}

## Sơ đồ rút gọn (chỉ cột khoá)

\`\`\`mermaid
${diagram(true)}
\`\`\`

## Sơ đồ đầy đủ

\`\`\`mermaid
${diagram(false)}
\`\`\`
`,
);
console.log(`✔ ERD: ${models.length} bảng, ${rels.length} quan hệ → ${out}`);
