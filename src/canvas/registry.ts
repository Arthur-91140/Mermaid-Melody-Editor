import type { ComponentType } from 'react';
import type { DiagramKind } from '../diagrams/common';
import { FlowCanvas } from './flowchart/FlowCanvas';
import { FlowInspector } from './flowchart/FlowInspector';

export interface VisualEditor {
  Canvas: ComponentType;
  Inspector: ComponentType;
}

/** Visual editors by diagram type; types missing here fall back to the Mermaid preview. */
export const VISUAL_EDITORS: Partial<Record<DiagramKind, VisualEditor>> = {
  flowchart: { Canvas: FlowCanvas, Inspector: FlowInspector },
};
