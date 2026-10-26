import type { ReactNode } from 'react';
import type { DiagramModel } from '../diagrams';
import type { Translate } from '../i18n';
import type { Layout } from '../store/documents';
import type { Structure } from './manual';

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
  /** Edges and groups, for diagrams whose elements can be moved and resized freely. */
  structure?: (model: M) => Structure;
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


/** Adds an invisible rectangle over a thin element (stick figure, line) so that it is easy to click. */
export function addHitArea(el: Element, id: string, pad = 6) {
  const g = el as SVGGraphicsElement;
  if (typeof g.getBBox !== 'function') return;
  const b = g.getBBox();
  if (!b.width && !b.height) return;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', String(b.x - pad));
  rect.setAttribute('y', String(b.y - pad));
  rect.setAttribute('width', String(b.width + pad * 2));
  rect.setAttribute('height', String(b.height + pad * 2));
  rect.setAttribute('fill', 'transparent');
  rect.setAttribute('pointer-events', 'all');
  rect.setAttribute('data-mme', id);
  rect.classList.add('mme-hit');
  // Inside groups the area goes last; next to a line it keeps the line's stacking order.
  if (el.tagName === 'g') el.appendChild(rect);
  else el.parentNode?.insertBefore(rect, el.nextSibling);
}
