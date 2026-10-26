export type ClassMarker = 'none' | 'inheritance' | 'composition' | 'aggregation' | 'arrow';

export interface ClassNode {
  id: string;
  label: string | null;
  /** Generic type written as `~T~`. */
  generic: string | null;
  annotations: string[];
  /** Attribute and method lines, verbatim, in source order. */
  members: string[];
  cssClasses: string[];
  style: string | null;
  namespace: string | null;
  /** Declared with `class X` in the source. */
  declared: boolean;
}

export interface ClassRelation {
  from: string;
  to: string;
  /** Marker drawn at the `from` end. */
  fromMarker: ClassMarker;
  /** Marker drawn at the `to` end. */
  toMarker: ClassMarker;
  line: 'solid' | 'dashed';
  fromCard: string | null;
  toCard: string | null;
  label: string | null;
}

export interface ClassNote {
  target: string | null;
  text: string;
}

export interface ClassModel {
  kind: 'class';
  keyword: string;
  direction: string | null;
  classes: ClassNode[];
  relations: ClassRelation[];
  notes: ClassNote[];
  namespaces: string[];
  classDefs: { names: string; style: string }[];
  extras: string[];
}

export const LEFT_MARKER: Record<ClassMarker, string> = {
  none: '',
  inheritance: '<|',
  composition: '*',
  aggregation: 'o',
  arrow: '<',
};

export const RIGHT_MARKER: Record<ClassMarker, string> = {
  none: '',
  inheritance: '|>',
  composition: '*',
  aggregation: 'o',
  arrow: '>',
};

export function emptyClass(id: string): ClassNode {
  return {
    id,
    label: null,
    generic: null,
    annotations: [],
    members: [],
    cssClasses: [],
    style: null,
    namespace: null,
    declared: false,
  };
}

export function isMethod(member: string): boolean {
  return member.includes('(');
}
