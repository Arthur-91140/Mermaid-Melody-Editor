/** Canvas ids of class diagram elements. */
export const classIds = {
  cls: (id: string) => `c:${id}`,
  ns: (name: string) => `ns:${name}`,
  note: (i: number) => `note:${i}`,
  rel: (i: number) => `r:${i}`,
  noteLink: (i: number) => `nl:${i}`,
  parse(cid: string): { kind: 'class' | 'namespace' | 'note' | 'relation' | 'noteLink'; id: string } {
    const at = cid.indexOf(':');
    const prefix = cid.slice(0, at);
    const id = cid.slice(at + 1);
    const kind = ({ c: 'class', ns: 'namespace', note: 'note', r: 'relation', nl: 'noteLink' } as const)[prefix] ?? 'class';
    return { kind, id };
  },
};
