import { ArrowRightLeft, Boxes, ChartGantt, CircleDot, Database, Network, Shapes, Workflow } from 'lucide-react';
import type { DiagramKind } from '../diagrams/common';

const ICONS = {
  flowchart: Workflow,
  sequence: ArrowRightLeft,
  class: Boxes,
  er: Database,
  state: CircleDot,
  mindmap: Network,
  gantt: ChartGantt,
  other: Shapes,
} satisfies Record<DiagramKind, unknown>;

export function KindIcon({ kind, size = 16 }: { kind: DiagramKind; size?: number }) {
  const Icon = ICONS[kind] ?? Shapes;
  return <Icon size={size} />;
}
