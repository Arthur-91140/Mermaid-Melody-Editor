/** Canvas ids of flowchart elements: `n:` nodes, `g:` subgraphs, `e:` edges (by index). */
export const flowIds = {
  node: (id: string) => `n:${id}`,
  group: (id: string) => `g:${id}`,
  edge: (i: number) => `e:${i}`,
  /** Splits a canvas id into its kind and model id. */
  parse(cid: string): { kind: 'node' | 'group' | 'edge'; id: string } {
    const kind = cid.startsWith('g:') ? 'group' : cid.startsWith('e:') ? 'edge' : 'node';
    return { kind, id: cid.slice(2) };
  },
};
