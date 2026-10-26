// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocuments } from './documents';

describe('documents store', () => {
  beforeEach(() => {
    localStorage.clear();
    useDocuments.setState({ index: [], currentId: null, code: '', layout: {}, past: [], future: [], lastEdit: null });
  });

  it('creates a first document and persists it', () => {
    useDocuments.getState().init(() => ({ name: 'Doc', code: 'flowchart TD\n  A' }));
    const s = useDocuments.getState();
    expect(s.index).toHaveLength(1);
    expect(s.index[0]).toMatchObject({ name: 'Doc', kind: 'flowchart' });
    expect(JSON.parse(localStorage.getItem(`mme:doc:${s.currentId}`)!).code).toBe('flowchart TD\n  A');
  });

  it('merges typing bursts but keeps canvas commits separate', () => {
    vi.useFakeTimers();
    const st = useDocuments.getState();
    st.createDoc('x', 'a');
    st.setCode('ab', 'typing');
    st.setCode('abc', 'typing');
    expect(useDocuments.getState().past.map((p) => p.code)).toEqual(['a']);
    vi.advanceTimersByTime(2000);
    st.setCode('abcd', 'typing');
    st.commit('canvas', { A: { x: 1, y: 2 } });
    expect(useDocuments.getState().past.map((p) => p.code)).toEqual(['a', 'abc', 'abcd']);
    st.undo();
    expect(useDocuments.getState()).toMatchObject({ code: 'abcd', layout: {} });
    st.redo();
    expect(useDocuments.getState()).toMatchObject({ code: 'canvas', layout: { A: { x: 1, y: 2 } } });
    vi.useRealTimers();
  });

  it('switches, duplicates and deletes documents', () => {
    const st = useDocuments.getState();
    const a = st.createDoc('A', 'graph TD\n  A');
    const b = st.createDoc('B', 'sequenceDiagram\n  A->>B: hi');
    st.openDoc(a);
    expect(useDocuments.getState().code).toBe('graph TD\n  A');
    const c = st.duplicateDoc(b, '(copie)')!;
    expect(useDocuments.getState().index.find((d) => d.id === c)!.name).toBe('B (copie)');
    expect(useDocuments.getState().code).toBe('sequenceDiagram\n  A->>B: hi');
    st.deleteDoc(c);
    expect(useDocuments.getState().index.map((d) => d.id)).toEqual([b, a]);
    expect(useDocuments.getState().currentId).toBe(b);
  });
});
