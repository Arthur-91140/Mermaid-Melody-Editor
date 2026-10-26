import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { useDocuments } from '../store/documents';
import { useSelection } from '../store/selection';
import { useStatus } from '../store/status';
import { mermaidSupport } from './mermaidLanguage';

const highlightLines = StateEffect.define<number[]>();

/** Lines highlighted when elements are selected on the canvas. */
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = tr.docChanged || tr.selection ? Decoration.none : deco;
    for (const e of tr.effects) {
      if (!e.is(highlightLines)) continue;
      const marks = e.value
        .filter((l) => l >= 1 && l <= tr.state.doc.lines)
        .sort((a, b) => a - b)
        .map((l) => Decoration.line({ class: 'cm-highlight-line' }).range(tr.state.doc.line(l).from));
      deco = Decoration.set(marks);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

let activeView: EditorView | null = null;

/** Highlights the given 1-based lines and scrolls the first one into view. */
export function revealLines(lines: number[]) {
  const view = activeView;
  if (!view) return;
  const valid = lines.filter((l) => l >= 1 && l <= view.state.doc.lines);
  view.dispatch({
    effects: [
      highlightLines.of(valid),
      ...(valid.length ? [EditorView.scrollIntoView(view.state.doc.line(valid[0]).from, { y: 'nearest' })] : []),
    ],
  });
}

/** Model id behind a canvas selection id, for the kinds whose id appears in the code. */
function referencedWord(cid: string): string | null {
  const m = /^(n|g|c|en|s|sg|p):(.+)$/.exec(cid);
  return m ? m[2] : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlights the code lines mentioning the elements selected on the canvas. */
function useSelectionHighlight() {
  const ids = useSelection((s) => s.ids);
  useEffect(() => {
    const words = ids.map(referencedWord).filter((w): w is string => !!w);
    if (!words.length) return revealLines([]);
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_-])(${words.map(escapeRe).join('|')})(?=$|[^\\p{L}\\p{N}_-])`, 'u');
    const lines = useDocuments.getState().code.split('\n');
    revealLines(lines.flatMap((l, i) => (i > 0 && !l.trim().startsWith('%%') && re.test(l) ? [i + 1] : [])));
  }, [ids]);
}

export function CodeEditor() {
  useSelectionHighlight();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const applying = useRef(false);
  const code = useDocuments((s) => s.code);
  const error = useStatus((s) => s.error);

  useEffect(() => {
    if (!host.current) return;
    const { undo, redo } = useDocuments.getState();
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: useDocuments.getState().code,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          lintGutter(),
          highlightField,
          EditorState.tabSize.of(4),
          EditorView.lineWrapping,
          keymap.of([
            { key: 'Mod-z', run: () => (undo(), true), preventDefault: true },
            { key: 'Mod-y', run: () => (redo(), true), preventDefault: true },
            { key: 'Mod-Shift-z', run: () => (redo(), true), preventDefault: true },
            indentWithTab,
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...searchKeymap,
            ...defaultKeymap,
          ]),
          mermaidSupport(),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !applying.current) {
              useDocuments.getState().setCode(u.state.doc.toString(), 'typing');
            }
          }),
        ],
      }),
    });
    view.current = v;
    activeView = v;
    return () => {
      v.destroy();
      if (activeView === v) activeView = null;
      view.current = null;
    };
  }, []);

  // Apply changes made elsewhere (canvas, undo, document switch) as a minimal edit.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === code) return;
    let start = 0;
    while (start < current.length && start < code.length && current[start] === code[start]) start++;
    let endA = current.length;
    let endB = code.length;
    while (endA > start && endB > start && current[endA - 1] === code[endB - 1]) {
      endA--;
      endB--;
    }
    applying.current = true;
    v.dispatch({ changes: { from: start, to: endA, insert: code.slice(start, endB) } });
    applying.current = false;
  }, [code]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const diagnostics: Diagnostic[] = [];
    if (error) {
      const lineNo = error.line && error.line <= v.state.doc.lines ? error.line : null;
      const line = lineNo ? v.state.doc.line(lineNo) : null;
      diagnostics.push({
        from: line ? line.from : 0,
        to: line ? Math.max(line.from + 1, line.to) : Math.min(1, v.state.doc.length),
        severity: 'error',
        message: error.message,
      });
    }
    v.dispatch(setDiagnostics(v.state, diagnostics));
  }, [error, code]);

  return <div className="code-editor" ref={host} />;
}
