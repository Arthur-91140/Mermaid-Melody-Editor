import type { ComponentType } from 'react';
import type { DiagramKind } from '../diagrams/common';

export interface VisualEditor {
  Canvas: ComponentType;
  Inspector: ComponentType;
}

/** Visual editors by diagram type; types missing here fall back to the Mermaid preview. */
export const VISUAL_EDITORS: Partial<Record<DiagramKind, VisualEditor>> = {};
