import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { DiagramKind } from '../diagrams/common';

export interface VisualEditor {
  Canvas: LazyExoticComponent<ComponentType>;
  Inspector: LazyExoticComponent<ComponentType>;
}

/** Loads a named export lazily so that each editor ships in its own chunk. */
function load<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}

/** Visual editors by diagram type; types missing here fall back to the Mermaid preview. */
export const VISUAL_EDITORS: Partial<Record<DiagramKind, VisualEditor>> = {
  flowchart: {
    Canvas: load(() => import('./flowchart/FlowCanvas'), 'FlowCanvas'),
    Inspector: load(() => import('./flowchart/FlowInspector'), 'FlowInspector'),
  },
  class: {
    Canvas: load(() => import('./class/ClassCanvas'), 'ClassCanvas'),
    Inspector: load(() => import('./class/ClassInspector'), 'ClassInspector'),
  },
  er: {
    Canvas: load(() => import('./er/ErCanvas'), 'ErCanvas'),
    Inspector: load(() => import('./er/ErInspector'), 'ErInspector'),
  },
  state: {
    Canvas: load(() => import('./state/StateCanvas'), 'StateCanvas'),
    Inspector: load(() => import('./state/StateInspector'), 'StateInspector'),
  },
  mindmap: {
    Canvas: load(() => import('./mindmap/MindCanvas'), 'MindCanvas'),
    Inspector: load(() => import('./mindmap/MindInspector'), 'MindInspector'),
  },
  sequence: {
    Canvas: load(() => import('./sequence/SequenceCanvas'), 'SequenceCanvas'),
    Inspector: load(() => import('./sequence/SequenceInspector'), 'SequenceInspector'),
  },
  gantt: {
    Canvas: load(() => import('./gantt/GanttCanvas'), 'GanttCanvas'),
    Inspector: load(() => import('./gantt/GanttInspector'), 'GanttInspector'),
  },
};
