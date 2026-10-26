import type { ReactNode } from 'react';
import type { DiagramModel } from '../diagrams';
import type { Translate } from '../i18n';
import type { Layout } from '../store/documents';

/** Result of an edit made on the preview. */
export interface PreviewEdit<M> {
  model: M;
  layout?: Layout;
  /** Selection to apply (canvas ids, shared with the inspector). */
  select?: string[];
  /** Element to rename right away. */
  edit?: string;
}

export interface PreviewAddAction<M> {
  id: string;
  title: string;
  icon: ReactNode;
  run: (model: M, selection: string[], layout: Layout) => PreviewEdit<M> | null;
}

/** How a diagram type is edited directly on Mermaid's rendering. */
export interface PreviewEditing<M extends DiagramModel = DiagramModel> {
  /** Tags rendered SVG elements with `data-mme` = the element's canvas id. */
  annotate: (svg: SVGSVGElement, model: M) => void;
  /** Text shown in the inline editor, or null when the element has no text. */
  textOf: (model: M, id: string) => string | null;
  commitText: (model: M, id: string, text: string, layout: Layout) => PreviewEdit<M> | null;
  remove: (model: M, ids: string[]) => M;
  /** Drag from one element to another. */
  connect?: (model: M, from: string, to: string, t: Translate) => PreviewEdit<M> | null;
  addActions: (t: Translate) => PreviewAddAction<M>[];
  /** Extra keyboard shortcuts (e.g. Tab / Enter in mind maps). */
  onKey?: (e: KeyboardEvent, model: M, selection: string[], t: Translate) => PreviewEdit<M> | null;
}

/** Removes the render-specific prefix Mermaid adds to element ids. */
export function cleanId(id: string): string {
  return id.replace(/^mme-render-\d+-/, '');
}

export function tag(el: Element | null | undefined, id: string) {
  if (el) el.setAttribute('data-mme', id);
}

export function renameKey(layout: Layout, from: string, to: string): Layout {
  if (from === to || !layout[from]) return layout;
  const { [from]: p, ...rest } = layout;
  return { ...rest, [to]: p };
}
