/** Arrows understood by Mermaid's sequence lexer, longest first. */
export const SEQ_ARROWS = [
  '<<-->>',
  '<<->>',
  '--|\\',
  '--|/',
  '--\\\\',
  '--//',
  '/|--',
  '\\|--',
  '//--',
  '\\\\--',
  '-->>',
  '->>',
  '-->',
  '--x',
  '--)',
  '-|\\',
  '-|/',
  '-\\\\',
  '-//',
  '/|-',
  '\\|-',
  '//-',
  '\\\\-',
  '->',
  '-x',
  '-)',
];

/** Arrows offered in the editor, in menu order. */
export const MAIN_ARROWS = ['->>', '-->>', '->', '-->', '-x', '--x', '-)', '--)', '<<->>', '<<-->>'];

export type ParticipantKind = 'participant' | 'actor';

export interface SeqParticipant {
  id: string;
  /** Text after `as`, shown instead of the id. */
  label: string | null;
  kind: ParticipantKind;
  /** Raw `@{ ... }` metadata (participant type, etc.). */
  meta: string | null;
  /** Declared explicitly in the source. */
  declared: boolean;
  /** Introduced mid-diagram with `create participant`. */
  created: boolean;
}

export interface SeqBox {
  /** Text after `box` (color and/or label), kept verbatim. */
  raw: string;
  members: string[];
}

export type NotePosition = 'left of' | 'right of' | 'over';

export type BlockKind = 'loop' | 'alt' | 'opt' | 'par' | 'par_over' | 'critical' | 'break' | 'rect';
export type BranchKind = 'else' | 'and' | 'option';

export type SeqItem =
  | { t: 'message'; from: string; to: string; arrow: string; text: string; activate: '' | '+' | '-' }
  | { t: 'note'; position: NotePosition; actors: string[]; text: string }
  | { t: 'activate'; actor: string }
  | { t: 'deactivate'; actor: string }
  | { t: 'block'; kind: BlockKind; label: string }
  | { t: 'branch'; kind: BranchKind; label: string }
  | { t: 'end' }
  | { t: 'create'; id: string }
  | { t: 'destroy'; actor: string }
  | { t: 'raw'; text: string };

export interface SeqModel {
  kind: 'sequence';
  title: string | null;
  participants: SeqParticipant[];
  boxes: SeqBox[];
  items: SeqItem[];
}

export const BRANCH_OF: Partial<Record<BlockKind, BranchKind>> = {
  alt: 'else',
  par: 'and',
  par_over: 'and',
  critical: 'option',
};
