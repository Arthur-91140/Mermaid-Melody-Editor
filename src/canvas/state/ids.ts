/** Canvas ids of state diagram elements. */
export const stateIds = {
  state: (id: string) => `s:${id}`,
  group: (id: string) => `sg:${id}`,
  note: (i: number) => `note:${i}`,
  transition: (i: number) => `t:${i}`,
  noteLink: (i: number) => `nl:${i}`,
  parse(cid: string): { kind: 'state' | 'note' | 'transition' | 'noteLink'; id: string } {
    const at = cid.indexOf(':');
    const prefix = cid.slice(0, at);
    const id = cid.slice(at + 1);
    if (prefix === 'note') return { kind: 'note', id };
    if (prefix === 't') return { kind: 'transition', id };
    if (prefix === 'nl') return { kind: 'noteLink', id };
    return { kind: 'state', id };
  },
};
