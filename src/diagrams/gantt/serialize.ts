import { INDENT } from '../common';
import type { GanttEnd, GanttModel, GanttStart, GanttTask } from './model';

const startText = (s: GanttStart) => (s.kind === 'after' ? `after ${s.ids.join(' ')}` : s.kind === 'date' ? s.value : '');
const endText = (e: GanttEnd) => (e.kind === 'until' ? `until ${e.ids.join(' ')}` : e.value);

export function taskMeta(t: GanttTask): string {
  if (t.raw !== null) return t.raw;
  const parts: string[] = [...t.tags];
  // Mermaid has no form for "id + implicit start": the id is only written with an explicit start.
  if (t.start.kind === 'prev') parts.push(endText(t.end));
  else {
    if (t.id) parts.push(t.id);
    parts.push(startText(t.start), endText(t.end));
  }
  return parts.join(', ');
}

export function serializeGantt(m: GanttModel): { header: string; body: string[] } {
  const body: string[] = [];
  for (const [k, v] of m.settings) body.push(INDENT + (v ? `${k} ${v}` : k));
  for (const e of m.extras) body.push(INDENT + e);
  for (const s of m.sections) {
    if (s.name !== null) body.push('', INDENT + `section ${s.name}`);
    for (const t of s.tasks) body.push(INDENT + `${t.name} :${taskMeta(t)}`);
  }
  return { header: 'gantt', body };
}
