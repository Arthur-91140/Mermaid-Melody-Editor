export type DiagramKind =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'er'
  | 'state'
  | 'mindmap'
  | 'gantt'
  | 'other';

export const VISUAL_KINDS: DiagramKind[] = [
  'flowchart',
  'sequence',
  'class',
  'er',
  'state',
  'mindmap',
  'gantt',
];

const KIND_BY_KEYWORD: Record<string, DiagramKind> = {
  flowchart: 'flowchart',
  graph: 'flowchart',
  'flowchart-elk': 'flowchart',
  sequenceDiagram: 'sequence',
  classDiagram: 'class',
  'classDiagram-v2': 'class',
  erDiagram: 'er',
  stateDiagram: 'state',
  'stateDiagram-v2': 'state',
  mindmap: 'mindmap',
  gantt: 'gantt',
};

export interface SplitDoc {
  /** Frontmatter, directives and comments placed before the header, kept verbatim. */
  preamble: string[];
  /** First word of the header line (e.g. `flowchart`, `sequenceDiagram`). */
  keyword: string;
  /** Rest of the header line after the keyword. */
  headerRest: string;
  /** Lines after the header. */
  body: string[];
  /** 0-based line index of the first body line in the original code. */
  bodyOffset: number;
  kind: DiagramKind;
}

export function splitDocument(code: string): SplitDoc {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((l, idx) => idx > 0 && l.trim() === '---');
    i = close === -1 ? lines.length : close + 1;
  }
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') {
      i++;
      continue;
    }
    if (t.startsWith('%%')) {
      if (t.startsWith('%%{') && !t.includes('}%%')) {
        while (i < lines.length && !lines[i].includes('}%%')) i++;
      }
      i++;
      continue;
    }
    break;
  }
  const preamble = lines.slice(0, i);
  while (preamble.length && preamble[preamble.length - 1].trim() === '') preamble.pop();
  const header = (lines[i] ?? '').trim();
  const keyword = /^[^\s;:]+/.exec(header)?.[0] ?? '';
  return {
    preamble,
    keyword,
    headerRest: header.slice(keyword.length),
    body: lines.slice(i + 1),
    bodyOffset: i + 1,
    kind: KIND_BY_KEYWORD[keyword] ?? 'other',
  };
}

export function detectKind(code: string): DiagramKind {
  return splitDocument(code).kind;
}

export function joinDocument(preamble: string[], header: string, body: string[]): string {
  return [...preamble, header, ...body].join('\n');
}

export const INDENT = '    ';

export function indent(lines: string[], depth = 1): string[] {
  const pad = INDENT.repeat(depth);
  return lines.map((l) => (l ? pad + l : l));
}

/** Removes surrounding double quotes if present. */
export function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

const ENTITY_NAMES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  apos: "'",
  semi: ';',
  colon: ':',
  num: '#',
};

/** Decodes Mermaid entity codes (`#quot;`, `#35;`, `#9829;`). */
export function decodeEntities(s: string): string {
  return s.replace(/#(\d+|[a-zA-Z]+);/g, (whole, code: string) => {
    if (/^\d+$/.test(code)) return String.fromCodePoint(Number(code));
    return ENTITY_NAMES[code.toLowerCase()] ?? whole;
  });
}

export function isMarkdownLabel(raw: string | null | undefined): boolean {
  return !!raw && raw.length >= 2 && raw.startsWith('`') && raw.endsWith('`');
}

/** Turns a raw Mermaid label into the text shown on the canvas. */
export function labelToDisplay(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = raw;
  if (isMarkdownLabel(s)) s = s.slice(1, -1);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  return decodeEntities(s);
}

/** Turns text typed by the user into a raw Mermaid label. */
export function displayToLabel(text: string, markdown = false): string {
  if (markdown) return '`' + text.replace(/`/g, "'") + '`';
  return text.replace(/"/g, '#quot;').replace(/\r?\n/g, '<br>');
}

const SAFE_LABEL = /^[\p{L}\p{N}][\p{L}\p{N} _\-.,!?']*$/u;

/** Quotes a label when Mermaid would otherwise misread it. */
export function fmtLabel(label: string): string {
  if (SAFE_LABEL.test(label) && !/\s$/.test(label)) return label;
  return '"' + label.replace(/"/g, '#quot;') + '"';
}

/** Quotes a string that must stay a single token (e.g. a relation label). */
export function quoteIfNeeded(s: string): string {
  if (/^[\p{L}\p{N}_\-.]+$/u.test(s)) return s;
  return '"' + s.replace(/"/g, '#quot;') + '"';
}

export interface Statement {
  text: string;
  /** 0-based line index (relative to the body) where the statement starts. */
  line: number;
}

/**
 * Splits body lines into statements: one per line, also split on `;`
 * outside quotes/brackets. Quoted strings and `@{ ... }` blocks may span
 * several lines.
 */
export function splitStatements(lines: string[], splitSemicolons = true): Statement[] {
  const out: Statement[] = [];
  let buf = '';
  let start = 0;
  let inQuote = false;
  let braces = 0;
  const flush = () => {
    const t = buf.trim();
    if (t) out.push({ text: t, line: start });
    buf = '';
  };
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!inQuote && braces === 0) {
      flush();
      start = li;
      if (line.trim().startsWith('%%')) {
        out.push({ text: line.trim(), line: li });
        continue;
      }
    } else {
      buf += '\n';
    }
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') inQuote = !inQuote;
      else if (!inQuote && ch === '@' && line[c + 1] === '{') {
        braces++;
        buf += '@{';
        c++;
        continue;
      } else if (!inQuote && braces > 0 && ch === '{') braces++;
      else if (!inQuote && braces > 0 && ch === '}') braces--;
      else if (!inQuote && braces === 0 && ch === ';' && splitSemicolons && !/#\w+$/.test(buf)) {
        flush();
        start = li;
        continue;
      }
      buf += ch;
    }
  }
  flush();
  return out;
}

export function uniqueId(base: string, taken: (id: string) => boolean): string {
  if (!taken(base)) return base;
  let n = 2;
  while (taken(`${base}${n}`)) n++;
  return `${base}${n}`;
}
