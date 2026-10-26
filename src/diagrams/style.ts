/** Helpers for Mermaid style strings such as `fill:#f9f,stroke:#333,stroke-width:2px`. */

export function parseStyle(style: string | null | undefined): [string, string][] {
  if (!style) return [];
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of style) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  const out: [string, string][] = [];
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i === -1) continue;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim().replace(/;$/, '');
    if (k) out.push([k, v]);
  }
  return out;
}

export function stringifyStyle(pairs: [string, string][]): string | null {
  const s = pairs.map(([k, v]) => `${k}:${v}`).join(',');
  return s || null;
}

export function getStyle(style: string | null | undefined, key: string): string {
  const pairs = parseStyle(style);
  for (let i = pairs.length - 1; i >= 0; i--) if (pairs[i][0] === key) return pairs[i][1];
  return '';
}

/** Sets (or removes, when `value` is empty) one property. */
export function setStyle(style: string | null | undefined, key: string, value: string | null): string | null {
  const pairs = parseStyle(style).filter(([k]) => k !== key);
  if (value) pairs.push([key, value]);
  return stringifyStyle(pairs);
}

/** CSS-ready view of a Mermaid style, merging class definitions then the element's own style. */
export interface VisualStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
  strokeDasharray?: string;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
}

export function visualStyle(...styles: (string | null | undefined)[]): VisualStyle {
  const out: VisualStyle = {};
  for (const s of styles) {
    for (const [k, v] of parseStyle(s)) {
      switch (k) {
        case 'fill':
          out.fill = v;
          break;
        case 'stroke':
          out.stroke = v;
          break;
        case 'stroke-width':
          out.strokeWidth = v;
          break;
        case 'stroke-dasharray':
          out.strokeDasharray = v;
          break;
        case 'color':
          out.color = v;
          break;
        case 'font-weight':
          out.fontWeight = v;
          break;
        case 'font-style':
          out.fontStyle = v;
          break;
      }
    }
  }
  return out;
}

/** Style strings of the class definitions applied to an element (`default` first). */
export function classStyles(
  classDefs: { names: string; style: string }[],
  classes: string[],
): string[] {
  const out: string[] = [];
  const find = (name: string) =>
    classDefs.filter((cd) => cd.names.split(',').map((n) => n.trim()).includes(name)).map((cd) => cd.style);
  out.push(...find('default'));
  for (const c of classes) out.push(...find(c));
  return out;
}
