import type { BlockKind } from '../../diagrams/sequence/model';

export const BLOCK_KINDS: BlockKind[] = ['loop', 'alt', 'opt', 'par', 'critical', 'break', 'rect'];

export const seqIds = {
  participant: (id: string) => `p:${id}`,
  item: (i: number) => `i:${i}`,
  parse(cid: string): { kind: 'participant' | 'item'; id: string } {
    return cid.startsWith('p:') ? { kind: 'participant', id: cid.slice(2) } : { kind: 'item', id: cid.slice(2) };
  },
};
