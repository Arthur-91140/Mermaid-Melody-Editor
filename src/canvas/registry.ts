import type { ComponentType } from 'react';
import type { DiagramKind } from '../diagrams/common';
import { ClassCanvas } from './class/ClassCanvas';
import { ClassInspector } from './class/ClassInspector';
import { ErCanvas } from './er/ErCanvas';
import { ErInspector } from './er/ErInspector';
import { FlowCanvas } from './flowchart/FlowCanvas';
import { MindCanvas } from './mindmap/MindCanvas';
import { MindInspector } from './mindmap/MindInspector';
import { StateCanvas } from './state/StateCanvas';
import { StateInspector } from './state/StateInspector';
import { FlowInspector } from './flowchart/FlowInspector';

export interface VisualEditor {
  Canvas: ComponentType;
  Inspector: ComponentType;
}

/** Visual editors by diagram type; types missing here fall back to the Mermaid preview. */
export const VISUAL_EDITORS: Partial<Record<DiagramKind, VisualEditor>> = {
  flowchart: { Canvas: FlowCanvas, Inspector: FlowInspector },
  class: { Canvas: ClassCanvas, Inspector: ClassInspector },
  er: { Canvas: ErCanvas, Inspector: ErInspector },
  state: { Canvas: StateCanvas, Inspector: StateInspector },
  mindmap: { Canvas: MindCanvas, Inspector: MindInspector },
};
