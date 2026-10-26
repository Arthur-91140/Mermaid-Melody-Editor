export type FlowLine = 'solid' | 'dotted' | 'thick' | 'invisible';
export type FlowMarker = 'none' | 'arrow' | 'circle' | 'cross';

export interface FlowNode {
  id: string;
  /** Raw Mermaid label (without surrounding quotes), or null when the id is shown. */
  label: string | null;
  /** Canonical shape key (see shapes.ts). */
  shape: string;
  /** Shape name exactly as written in `@{ shape: ... }`, kept for round-trips. */
  shapeName: string | null;
  syntax: 'classic' | 'at';
  /** Other `@{ ... }` properties, kept verbatim as [key, rawValue]. */
  props: [string, string][];
  classes: string[];
  style: string | null;
  click: string | null;
  /** Id of the subgraph containing the node. */
  parent: string | null;
}

export interface FlowSubgraph {
  id: string;
  title: string | null;
  /** True when the source did not give an id (`subgraph "Title"`). */
  implicitId: boolean;
  direction: string | null;
  parent: string | null;
  classes: string[];
  style: string | null;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string | null;
  line: FlowLine;
  head: FlowMarker;
  tail: FlowMarker;
  /** 1 for `-->`, 2 for `--->`, ... */
  length: number;
  edgeId: string | null;
  /** Raw `id@{ ... }` properties of an identified edge. */
  props: string | null;
  style: string | null;
}

export interface FlowClassDef {
  names: string;
  style: string;
}

export interface FlowModel {
  kind: 'flowchart';
  keyword: string;
  direction: string;
  nodes: FlowNode[];
  subgraphs: FlowSubgraph[];
  edges: FlowEdge[];
  classDefs: FlowClassDef[];
  linkStyleDefault: string | null;
  /** Statements the editor does not model (comments, accessibility, ...), kept verbatim. */
  extras: string[];
}

export function emptyFlowNode(id: string): FlowNode {
  return {
    id,
    label: null,
    shape: 'rect',
    shapeName: null,
    syntax: 'classic',
    props: [],
    classes: [],
    style: null,
    click: null,
    parent: null,
  };
}

export function emptyFlowEdge(from: string, to: string): FlowEdge {
  return {
    from,
    to,
    label: null,
    line: 'solid',
    head: 'arrow',
    tail: 'none',
    length: 1,
    edgeId: null,
    props: null,
    style: null,
  };
}
