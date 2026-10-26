export type ErCard = 'zero-one' | 'exactly-one' | 'zero-many' | 'one-many';

export interface ErAttribute {
  type: string;
  name: string;
  keys: string[];
  comment: string | null;
}

export interface ErEntity {
  id: string;
  alias: string | null;
  attributes: ErAttribute[];
  cssClasses: string[];
  style: string | null;
}

export interface ErRelation {
  from: string;
  to: string;
  /** Cardinality on the `from` side. */
  fromCard: ErCard;
  /** Cardinality on the `to` side. */
  toCard: ErCard;
  identifying: boolean;
  label: string;
}

export interface ErModel {
  kind: 'er';
  direction: string | null;
  entities: ErEntity[];
  relations: ErRelation[];
  classDefs: { names: string; style: string }[];
  extras: string[];
}

/** Symbol written next to the left entity. */
export const LEFT_CARD: Record<ErCard, string> = {
  'zero-one': '|o',
  'exactly-one': '||',
  'zero-many': '}o',
  'one-many': '}|',
};

/** Symbol written next to the right entity. */
export const RIGHT_CARD: Record<ErCard, string> = {
  'zero-one': 'o|',
  'exactly-one': '||',
  'zero-many': 'o{',
  'one-many': '|{',
};

export const ER_CARDS: ErCard[] = ['exactly-one', 'zero-one', 'one-many', 'zero-many'];

export function emptyEntity(id: string): ErEntity {
  return { id, alias: null, attributes: [], cssClasses: [], style: null };
}
