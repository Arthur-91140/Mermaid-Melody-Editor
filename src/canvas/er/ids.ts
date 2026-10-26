/** Canvas ids of ER elements: `en:` entities, `rel:` relationships (by index). */
export const erIds = {
  entity: (id: string) => `en:${id}`,
  rel: (i: number) => `rel:${i}`,
  parse(cid: string): { kind: 'entity' | 'relation'; id: string } {
    return cid.startsWith('rel:') ? { kind: 'relation', id: cid.slice(4) } : { kind: 'entity', id: cid.slice(3) };
  },
};
