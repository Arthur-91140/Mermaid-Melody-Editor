import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const HEADERS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'classDiagram-v2',
  'erDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'mindmap',
  'gantt',
  'pie',
  'journey',
  'gitGraph',
  'timeline',
  'quadrantChart',
  'xychart-beta',
  'xychart',
  'sankey-beta',
  'sankey',
  'requirementDiagram',
  'C4Context',
  'block-beta',
  'block',
  'architecture-beta',
  'architecture',
  'packet-beta',
  'packet',
  'kanban',
  'radar-beta',
  'treemap-beta',
];

const KEYWORDS = [
  'subgraph',
  'end',
  'direction',
  'classDef',
  'class',
  'style',
  'linkStyle',
  'click',
  'href',
  'call',
  'callback',
  'participant',
  'actor',
  'as',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'par_over',
  'and',
  'critical',
  'option',
  'break',
  'rect',
  'box',
  'note',
  'Note',
  'over',
  'left',
  'right',
  'of',
  'for',
  'activate',
  'deactivate',
  'autonumber',
  'create',
  'destroy',
  'title',
  'accTitle',
  'accDescr',
  'section',
  'dateFormat',
  'axisFormat',
  'tickInterval',
  'excludes',
  'includes',
  'todayMarker',
  'weekday',
  'weekend',
  'after',
  'until',
  'done',
  'active',
  'crit',
  'milestone',
  'state',
  'namespace',
  'cssClass',
  'link',
  'links',
  'TB',
  'TD',
  'BT',
  'LR',
  'RL',
  'PK',
  'FK',
  'UK',
];

const KEYWORD_SET = new Set([...KEYWORDS, ...HEADERS]);

interface State {
  inDirective: boolean;
}

const parser: StreamParser<State> = {
  name: 'mermaid',
  startState: () => ({ inDirective: false }),
  token(stream, state) {
    if (state.inDirective) {
      if (stream.skipTo('}%%')) {
        stream.match('}%%');
        state.inDirective = false;
      } else stream.skipToEnd();
      return 'meta';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('%%{')) {
      state.inDirective = true;
      return 'meta';
    }
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.sol() && stream.match(/^---\s*$/)) return 'meta';
    if (stream.match(/^"[^"]*"?/)) return 'string';
    if (stream.match(/^`[^`]*`?/)) return 'string';
    if (stream.match(/^:::[\w-]+/)) return 'className';
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'number';
    if (stream.match(/^#\w+;/)) return 'escape';
    if (stream.match(/^<<[^>]*>>/)) return 'annotation';
    if (stream.match(/^\[\*\]/)) return 'atom';
    if (stream.match(/^(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\))/)) return 'operator';
    if (stream.match(/^[<xo]?(-{2,}|={2,}|-\.+-|~{3,})[>xo-]?/)) return 'operator';
    if (stream.match(/^(\|o|\|\||\}o|\}\||o\||o\{|\|\{)(--|\.\.)?/)) return 'operator';
    if (stream.match(/^(<\||\*|o)?(--|\.\.)(\|>|\*|o|>)?/)) return 'operator';
    if (stream.match(/^\|[^|\n]*\|/)) return 'string';
    if (stream.match(/^\d+(\.\d+)?(ms|[Mdhmswy])?\b/)) return 'number';
    if (stream.match(/^[[\](){}]/)) return 'bracket';
    const word = stream.match(/^[\p{L}\p{N}_\-$.]+/u) as RegExpMatchArray | null;
    if (word) {
      const w = word[0];
      if (HEADERS.includes(w)) return 'heading';
      if (KEYWORD_SET.has(w)) return 'keyword';
      return 'variableName';
    }
    if (stream.match(/^:/)) {
      return 'punctuation';
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '%%' } },
};

export const mermaidLanguage = StreamLanguage.define(parser);

export const mermaidHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--hl-heading)', fontWeight: '700' },
  { tag: tags.keyword, color: 'var(--hl-keyword)', fontWeight: '600' },
  { tag: tags.comment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--hl-meta)' },
  { tag: tags.string, color: 'var(--hl-string)' },
  { tag: tags.operator, color: 'var(--hl-operator)', fontWeight: '600' },
  { tag: tags.number, color: 'var(--hl-number)' },
  { tag: tags.className, color: 'var(--hl-class)' },
  { tag: tags.annotation, color: 'var(--hl-class)' },
  { tag: tags.atom, color: 'var(--hl-operator)' },
  { tag: tags.escape, color: 'var(--hl-number)' },
  { tag: tags.bracket, color: 'var(--hl-bracket)' },
  { tag: tags.variableName, color: 'var(--text)' },
  { tag: tags.punctuation, color: 'var(--hl-bracket)' },
]);

function completions(context: CompletionContext) {
  const word = context.matchBefore(/[\p{L}\p{N}_\-]+/u);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const doc = context.state.doc.toString();
  const seen = new Set<string>();
  const options: Completion[] = [];
  const add = (label: string, type: string, boost = 0) => {
    if (seen.has(label) || label === word.text) return;
    seen.add(label);
    options.push({ label, type, boost });
  };
  const firstLine = context.state.doc.line(1).number === context.state.doc.lineAt(word.from).number;
  for (const h of HEADERS) add(h, 'type', firstLine ? 10 : -5);
  for (const k of KEYWORDS) add(k, 'keyword');
  for (const m of doc.matchAll(/[\p{L}_][\p{L}\p{N}_\-]{1,}/gu)) add(m[0], 'variable', 2);
  return { from: word.from, options, validFor: /^[\p{L}\p{N}_\-]*$/u };
}

export function mermaidSupport() {
  return [mermaidLanguage, syntaxHighlighting(mermaidHighlight), autocompletion({ override: [completions] })];
}
