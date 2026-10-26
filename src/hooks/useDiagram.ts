import { useCallback } from 'react';
import { parseDocument, serializeDocument, type DiagramModel, type ParsedDocument } from '../diagrams';
import { useDocuments, type Layout } from '../store/documents';

let cache: { code: string; parsed: ParsedDocument } | null = null;

/** Parses the code once per version, shared by every component that needs the model. */
export function parseCached(code: string): ParsedDocument {
  if (cache?.code === code) return cache.parsed;
  let parsed: ParsedDocument;
  try {
    parsed = parseDocument(code);
  } catch (err) {
    console.error('Parser failure', err);
    parsed = cache?.parsed ?? { kind: 'other', keyword: '', preamble: [], model: null, bodyOffset: 0 };
  }
  cache = { code, parsed };
  return parsed;
}

export interface DiagramApi<M extends DiagramModel = DiagramModel> {
  parsed: ParsedDocument;
  model: M;
  layout: Layout;
  /** Writes a new model (and optionally positions) back to the code as one undo step. */
  apply: (next: M, layout?: Layout) => void;
  setLayout: (layout: Layout, record?: boolean) => void;
}

export function useParsed(): ParsedDocument {
  const code = useDocuments((s) => s.code);
  return parseCached(code);
}

export function useDiagram<M extends DiagramModel>(): DiagramApi<M> {
  const parsed = useParsed();
  const layout = useDocuments((s) => s.layout);
  const apply = useCallback((next: M, nextLayout?: Layout) => {
    const current = parseCached(useDocuments.getState().code);
    useDocuments.getState().commit(serializeDocument(current.preamble, next), nextLayout);
  }, []);
  const setLayout = useCallback((l: Layout, record?: boolean) => useDocuments.getState().setLayout(l, record), []);
  return { parsed, model: parsed.model as M, layout, apply, setLayout };
}
