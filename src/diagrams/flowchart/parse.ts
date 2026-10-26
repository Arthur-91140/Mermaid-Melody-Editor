import { splitStatements, unquote } from '../common';
import {
  emptyFlowEdge,
  emptyFlowNode,
  type FlowEdge,
  type FlowLine,
  type FlowMarker,
  type FlowModel,
  type FlowNode,
  type FlowSubgraph,
} from './model';
import { CLASSIC_SHAPES, normalizeShape } from './shapes';

interface NodeRef {
  id: string;
  label?: string | null;
  shape?: string;
  shapeName?: string | null;
  syntax?: 'classic' | 'at';
  props?: [string, string][];
  classes: string[];
}

interface LinkProto {
  line: FlowLine;
  head: FlowMarker;
  tail: FlowMarker;
  length: number;
  label: string | null;
  edgeId: string | null;
}

const ID_CHAR = /[\p{L}\p{N}_$!?.\/\\*+']/u;
const ID_CHAR_OR_DASH_SAFE = /[\p{L}\p{N}_$!?\/\\*+']/u;

function skipWs(s: string, pos: number): number {
  while (pos < s.length && /\s/.test(s[pos])) pos++;
  return pos;
}

function readId(s: string, pos: number): number {
  let i = pos;
  while (i < s.length) {
    const ch = s[i];
    if (ID_CHAR.test(ch)) {
      i++;
    } else if (ch === '-' && i > pos && ID_CHAR_OR_DASH_SAFE.test(s[i + 1] ?? '')) {
      i++;
    } else if (ch === '=' && i > pos && s[i + 1] !== '=' && ID_CHAR.test(s[i + 1] ?? '')) {
      i++;
    } else break;
  }
  return i;
}

/** Last character of a closer: unquoted text may not contain it. */
function terminal(close: string): string {
  return close[close.length - 1];
}

function readShapeText(s: string, start: number, close: string): { text: string; end: number } | null {
  const quoted = /\s*"([^"]*)"\s*/y;
  quoted.lastIndex = start;
  const qm = quoted.exec(s);
  if (qm && s.startsWith(close, quoted.lastIndex)) {
    return { text: qm[1], end: quoted.lastIndex + close.length };
  }
  const idx = s.indexOf(close, start);
  if (idx === -1) return null;
  const text = s.slice(start, idx);
  if (text.includes(terminal(close)) || text.includes('"')) return null;
  return { text: text.trim(), end: idx + close.length };
}

/** Splits `a: 1, b: "x, y"` on commas/newlines that are outside quotes and brackets. */
export function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQ = false;
  let cur = '';
  for (const ch of body) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && (ch === '{' || ch === '[')) depth++;
    else if (!inQ && (ch === '}' || ch === ']')) depth--;
    if (!inQ && depth === 0 && (ch === ',' || ch === '\n')) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Parses the `{ ... }` following `@` (pos points at `@`). */
function readAtBlock(s: string, pos: number): { raw: string; end: number } | null {
  let depth = 0;
  let inQ = false;
  for (let i = pos + 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === '{') depth++;
    else if (!inQ && ch === '}') {
      depth--;
      if (depth === 0) return { raw: s.slice(pos + 2, i), end: i + 1 };
    }
  }
  return null;
}

export function parseAtProps(raw: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of splitTopLevel(raw)) {
    const m = /^([\w-]+)\s*:\s*([\s\S]*)$/.exec(part);
    if (m) out.push([m[1], m[2].trim()]);
  }
  return out;
}

function parseNodeRef(s: string, start: number): { ref: NodeRef; end: number } | null {
  const pos = skipWs(s, start);
  const idEnd = readId(s, pos);
  if (idEnd === pos) return null;
  const ref: NodeRef = { id: s.slice(pos, idEnd), classes: [] };
  let i = idEnd;
  if (s.startsWith('@{', i)) {
    const block = readAtBlock(s, i);
    if (!block) return null;
    const props = parseAtProps(block.raw);
    const rest: [string, string][] = [];
    let shapeName: string | null = null;
    let label: string | null | undefined;
    for (const [k, v] of props) {
      if (k === 'shape') shapeName = unquote(v);
      else if (k === 'label') label = unquote(v);
      else rest.push([k, v]);
    }
    ref.syntax = 'at';
    ref.shapeName = shapeName;
    ref.shape = shapeName ? normalizeShape(shapeName) : 'rect';
    ref.props = rest;
    if (label !== undefined) ref.label = label;
    i = block.end;
  } else {
    for (const cs of CLASSIC_SHAPES) {
      if (!s.startsWith(cs.open, i)) continue;
      const r = readShapeText(s, i + cs.open.length, cs.close);
      if (!r) continue;
      ref.shape = cs.shape;
      ref.shapeName = null;
      ref.syntax = 'classic';
      ref.props = [];
      ref.label = r.text;
      i = r.end;
      break;
    }
  }
  while (s.startsWith(':::', i)) {
    const m = /:::([\w-]+)/y;
    m.lastIndex = i;
    const mm = m.exec(s);
    if (!mm) return null;
    ref.classes.push(mm[1]);
    i = m.lastIndex;
  }
  return { ref, end: i };
}

function parseGroup(s: string, start: number): { refs: NodeRef[]; end: number } | null {
  const first = parseNodeRef(s, start);
  if (!first) return null;
  const refs = [first.ref];
  let pos = first.end;
  for (;;) {
    const p = skipWs(s, pos);
    if (s[p] !== '&') break;
    const next = parseNodeRef(s, p + 1);
    if (!next) return null;
    refs.push(next.ref);
    pos = next.end;
  }
  return { refs, end: pos };
}

const MARKER: Record<string, FlowMarker> = { '>': 'arrow', '<': 'arrow', x: 'cross', o: 'circle' };

const FULL_LINKS: { line: FlowLine; re: RegExp }[] = [
  { line: 'solid', re: /([xo<]?)(-{2,})([-xo>])/y },
  { line: 'thick', re: /([xo<]?)(={2,})([=xo>])/y },
  { line: 'dotted', re: /([xo<]?)-?(\.+)-([xo>]?)/y },
  { line: 'invisible', re: /(~{3,})/y },
];

const START_LINK = /([xo<]?)(--|==|-\.)/y;
const END_LINKS: Record<string, { line: FlowLine; re: RegExp }> = {
  '--': { line: 'solid', re: /(-{2,})([-xo>])/g },
  '==': { line: 'thick', re: /(={2,})([=xo>])/g },
  '-.': { line: 'dotted', re: /(\.+)-([xo>]?)/g },
};

function protoFrom(line: FlowLine, tailCh: string, body: string, headCh: string): LinkProto {
  let length = 1;
  if (line === 'invisible') length = Math.max(1, body.length - 2);
  else if (line === 'dotted') length = Math.max(1, body.length);
  else length = Math.max(1, body.length - 1);
  return {
    line,
    tail: MARKER[tailCh] ?? 'none',
    head: line === 'invisible' ? 'none' : (MARKER[headCh] ?? 'none'),
    length,
    label: null,
    edgeId: null,
  };
}

function readPipeLabel(s: string, pos: number): { label: string; end: number } | null {
  const p = skipWs(s, pos);
  if (s[p] !== '|') return null;
  const quoted = /\s*"([^"]*)"\s*\|/y;
  quoted.lastIndex = p + 1;
  const qm = quoted.exec(s);
  if (qm) return { label: qm[1], end: quoted.lastIndex };
  const close = s.indexOf('|', p + 1);
  if (close === -1) return null;
  return { label: s.slice(p + 1, close).trim(), end: close + 1 };
}

function parseLink(s: string, start: number): { link: LinkProto; end: number } | null {
  let pos = skipWs(s, start);
  let edgeId: string | null = null;
  const idRe = /([A-Za-z0-9_]+)@(?=[<xo]?[-=.~])/y;
  idRe.lastIndex = pos;
  const idm = idRe.exec(s);
  if (idm) {
    edgeId = idm[1];
    pos = idRe.lastIndex;
  }
  for (const { line, re } of FULL_LINKS) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) continue;
    const link =
      line === 'invisible' ? protoFrom(line, '', m[1], '') : protoFrom(line, m[1], m[2], m[3]);
    link.edgeId = edgeId;
    let end = re.lastIndex;
    const pipe = readPipeLabel(s, end);
    if (pipe) {
      link.label = pipe.label;
      end = pipe.end;
    }
    return { link, end };
  }
  START_LINK.lastIndex = pos;
  const sm = START_LINK.exec(s);
  if (!sm) return null;
  const endDef = END_LINKS[sm[2]];
  endDef.re.lastIndex = START_LINK.lastIndex;
  const em = endDef.re.exec(s);
  if (!em) return null;
  const rawLabel = s.slice(START_LINK.lastIndex, em.index).trim();
  if (!rawLabel) return null;
  const link = protoFrom(endDef.line, sm[1], em[1], em[2]);
  link.label = unquote(rawLabel);
  link.edgeId = edgeId;
  return { link, end: endDef.re.lastIndex };
}

function parseChain(s: string): { groups: NodeRef[][]; links: LinkProto[] } | null {
  const g0 = parseGroup(s, 0);
  if (!g0) return null;
  const groups = [g0.refs];
  const links: LinkProto[] = [];
  let pos = g0.end;
  for (;;) {
    pos = skipWs(s, pos);
    if (pos >= s.length) break;
    const l = parseLink(s, pos);
    if (!l) return null;
    const g = parseGroup(s, l.end);
    if (!g) return null;
    links.push(l.link);
    groups.push(g.refs);
    pos = g.end;
  }
  return { groups, links };
}

function parseSubgraphHeader(rest: string): { id: string | null; title: string | null } {
  const r = rest.trim();
  let m = /^([^\s[\]"]+)\s*\[(.*)\]$/.exec(r);
  if (m) return { id: m[1], title: unquote(m[2]) };
  m = /^"(.*)"$/.exec(r);
  if (m) return { id: null, title: m[1] };
  if (/^[^\s"]+$/.test(r)) return { id: r, title: null };
  return { id: null, title: r };
}

export function parseFlowchart(keyword: string, headerRest: string, body: string[]): FlowModel {
  const model: FlowModel = {
    kind: 'flowchart',
    keyword,
    direction: '',
    nodes: [],
    subgraphs: [],
    edges: [],
    classDefs: [],
    linkStyleDefault: null,
    extras: [],
  };

  const hr = headerRest.trim();
  const semi = hr.indexOf(';');
  model.direction = (semi === -1 ? hr : hr.slice(0, semi)).trim();
  const inline = semi === -1 ? '' : hr.slice(semi + 1).trim();
  const statements = splitStatements(inline ? [inline, ...body] : body);

  const nodeMap = new Map<string, FlowNode>();
  const sgMap = new Map<string, FlowSubgraph>();
  const stack: { sg: FlowSubgraph; mentions: string[] }[] = [];
  const claimedBy = new Map<string, string>();
  const linkStyles: { target: string; style: string }[] = [];
  const classStmts: { ids: string[]; cls: string }[] = [];
  const styleStmts: { id: string; style: string }[] = [];
  const clickStmts: { id: string; rest: string }[] = [];
  let implicitCount = 0;

  const mention = (id: string) => {
    if (stack.length) stack[stack.length - 1].mentions.push(id);
  };

  const touchNode = (ref: NodeRef) => {
    let n = nodeMap.get(ref.id);
    if (!n) {
      n = emptyFlowNode(ref.id);
      nodeMap.set(ref.id, n);
      model.nodes.push(n);
    }
    if (ref.shape !== undefined) {
      n.shape = ref.shape;
      n.shapeName = ref.shapeName ?? null;
      n.syntax = ref.syntax ?? 'classic';
      n.props = ref.props ?? [];
    }
    if (ref.label !== undefined) n.label = ref.label;
    for (const c of ref.classes) if (!n.classes.includes(c)) n.classes.push(c);
    mention(ref.id);
  };

  const closeSubgraph = () => {
    const top = stack.pop();
    if (!top) return;
    for (const id of top.mentions) {
      if (!claimedBy.has(id)) claimedBy.set(id, top.sg.id);
    }
  };

  for (const { text: t } of statements) {
    if (t.startsWith('%%')) {
      model.extras.push(t);
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^subgraph(?:\s+(.*))?$/.exec(t))) {
      const h = parseSubgraphHeader(m[1] ?? '');
      const id = h.id ?? `__subgraph${implicitCount++}`;
      const sg: FlowSubgraph = {
        id,
        title: h.title,
        implicitId: h.id === null,
        direction: null,
        parent: stack.length ? stack[stack.length - 1].sg.id : null,
        classes: [],
        style: null,
      };
      if (!sgMap.has(id)) {
        sgMap.set(id, sg);
        model.subgraphs.push(sg);
      }
      stack.push({ sg: sgMap.get(id)!, mentions: [] });
      continue;
    }
    if (t === 'end') {
      if (stack.length) closeSubgraph();
      else model.extras.push(t);
      continue;
    }
    if ((m = /^direction\s+(\S+)$/.exec(t))) {
      if (stack.length) stack[stack.length - 1].sg.direction = m[1];
      else model.direction = m[1];
      continue;
    }
    if ((m = /^classDef\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      model.classDefs.push({ names: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = /^class\s+(\S+)\s+(\S+)$/.exec(t))) {
      classStmts.push({ ids: m[1].split(',').filter(Boolean), cls: m[2] });
      continue;
    }
    if ((m = /^style\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      styleStmts.push({ id: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = /^linkStyle\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      linkStyles.push({ target: m[1], style: m[2].trim() });
      continue;
    }
    if ((m = /^click\s+(\S+)\s+([\s\S]*)$/.exec(t))) {
      clickStmts.push({ id: m[1], rest: m[2].trim() });
      continue;
    }
    if (/^acc(Title|Descr)\b/.test(t)) {
      model.extras.push(t);
      continue;
    }
    const chain = parseChain(t);
    if (!chain) {
      model.extras.push(t);
      continue;
    }
    for (const g of chain.groups) for (const ref of g) touchNode(ref);
    chain.links.forEach((link, k) => {
      let first = true;
      for (const a of chain.groups[k]) {
        for (const b of chain.groups[k + 1]) {
          const e: FlowEdge = { ...emptyFlowEdge(a.id, b.id), ...link };
          if (!first) e.edgeId = null;
          first = false;
          model.edges.push(e);
        }
      }
    });
  }
  while (stack.length) closeSubgraph();

  // Identified edges get their properties through `id@{ ... }`, which reads like a node.
  for (const e of model.edges) {
    if (!e.edgeId) continue;
    const n = nodeMap.get(e.edgeId);
    if (n && n.syntax === 'at') {
      const parts = [
        ...(n.shapeName ? [`shape: ${n.shapeName}`] : []),
        ...n.props.map(([k, v]) => `${k}: ${v}`),
      ];
      e.props = parts.join(', ');
      nodeMap.delete(n.id);
    }
  }
  // A subgraph id referenced from an edge is not a node.
  for (const id of sgMap.keys()) nodeMap.delete(id);
  model.nodes = model.nodes.filter((n) => nodeMap.get(n.id) === n);

  for (const n of model.nodes) {
    const owner = claimedBy.get(n.id);
    n.parent = owner && sgMap.has(owner) ? owner : null;
  }

  for (const ls of linkStyles) {
    if (ls.target === 'default') {
      model.linkStyleDefault = ls.style;
      continue;
    }
    const idx = ls.target.split(',').map((x) => Number(x.trim()));
    if (idx.some((x) => !Number.isInteger(x) || !model.edges[x])) {
      model.extras.push(`linkStyle ${ls.target} ${ls.style}`);
      continue;
    }
    for (const x of idx) model.edges[x].style = ls.style;
  }

  for (const cs of classStmts) {
    const unknown: string[] = [];
    for (const id of cs.ids) {
      const target = nodeMap.get(id) ?? sgMap.get(id);
      if (!target) unknown.push(id);
      else if (!target.classes.includes(cs.cls)) target.classes.push(cs.cls);
    }
    if (unknown.length) model.extras.push(`class ${unknown.join(',')} ${cs.cls}`);
  }

  for (const st of styleStmts) {
    const target = nodeMap.get(st.id) ?? sgMap.get(st.id);
    if (!target) model.extras.push(`style ${st.id} ${st.style}`);
    else target.style = target.style ? `${target.style},${st.style}` : st.style;
  }

  for (const c of clickStmts) {
    const n = nodeMap.get(c.id);
    if (!n) model.extras.push(`click ${c.id} ${c.rest}`);
    else n.click = c.rest;
  }

  return model;
}
