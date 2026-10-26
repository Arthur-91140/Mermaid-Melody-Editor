import type { DiagramKind } from '../diagrams/common';
import { classPreview } from './class';
import { erPreview } from './er';
import { flowPreview } from './flowchart';
import { ganttPreview } from './gantt';
import { mindPreview } from './mindmap';
import { sequencePreview } from './sequence';
import { statePreview } from './state';
import type { PreviewEditing } from './types';

/** Diagram types that can be edited directly on Mermaid's rendering. */
export const PREVIEW_EDITING: Partial<Record<DiagramKind, PreviewEditing>> = {
  flowchart: flowPreview as PreviewEditing,
  sequence: sequencePreview as PreviewEditing,
  class: classPreview as PreviewEditing,
  er: erPreview as PreviewEditing,
  state: statePreview as PreviewEditing,
  mindmap: mindPreview as PreviewEditing,
  gantt: ganttPreview as PreviewEditing,
};
