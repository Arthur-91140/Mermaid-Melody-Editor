import {
  GANTT_SETTINGS,
  GANTT_TAGS,
  type GanttEnd,
  type GanttModel,
  type GanttSetting,
  type GanttStart,
  type GanttTag,
  type GanttTask,
} from './model';

const DURATION_RE = /^\d+(?:\.\d+)?(?:ms|[Mdhmswy])$/;

export function parseStart(s: string): GanttStart {
  const m = /^after\s+(.+)$/.exec(s.trim());
  if (m) return { kind: 'after', ids: m[1].trim().split(/\s+/) };
  return { kind: 'date', value: s.trim() };
}

export function parseEnd(s: string): GanttEnd {
  const t = s.trim();
  const m = /^until\s+(.+)$/.exec(t);
  if (m) return { kind: 'until', ids: m[1].trim().split(/\s+/) };
  if (DURATION_RE.test(t)) return { kind: 'duration', value: t };
  return { kind: 'date', value: t };
}

export function parseTaskMeta(meta: string): Pick<GanttTask, 'id' | 'tags' | 'start' | 'end'> | null {
  const parts = meta.split(',').map((p) => p.trim());
  const tags: GanttTag[] = [];
  while (parts.length && (GANTT_TAGS as readonly string[]).includes(parts[0])) {
    tags.push(parts.shift() as GanttTag);
  }
  if (parts.length === 1 && parts[0]) return { id: null, tags, start: { kind: 'prev' }, end: parseEnd(parts[0]) };
  if (parts.length === 2) return { id: null, tags, start: parseStart(parts[0]), end: parseEnd(parts[1]) };
  if (parts.length === 3) return { id: parts[0], tags, start: parseStart(parts[1]), end: parseEnd(parts[2]) };
  return null;
}

export function parseGantt(body: string[]): GanttModel {
  const model: GanttModel = { kind: 'gantt', settings: [], sections: [{ name: null, tasks: [] }], extras: [] };
  let count = 0;
  for (const raw of body) {
    const t = raw.trim();
    if (!t) continue;
    let m: RegExpExecArray | null;
    if (t.startsWith('%%') || /^(accTitle|accDescr|click)\b/.test(t)) {
      model.extras.push(t);
      continue;
    }
    // Like Mermaid's lexer, a known keyword wins over a task line.
    const kw = /^(\w+)(?:\s+(.*))?$/.exec(t);
    if (kw && (GANTT_SETTINGS as readonly string[]).includes(kw[1])) {
      model.settings.push([kw[1] as GanttSetting, (kw[2] ?? '').trim()]);
      continue;
    }
    if ((m = /^section\s+(.*)$/.exec(t))) {
      model.sections.push({ name: m[1].trim(), tasks: [] });
      continue;
    }
    if ((m = /^([^:]+):(.*)$/.exec(t))) {
      const meta = parseTaskMeta(m[2]);
      model.sections[model.sections.length - 1].tasks.push({
        key: `t${count++}`,
        name: m[1].trim(),
        ...(meta ?? { id: null, tags: [], start: { kind: 'prev' }, end: { kind: 'duration', value: '1d' } }),
        raw: meta ? null : m[2].trim(),
      });
      continue;
    }
    model.extras.push(t);
  }
  if (!model.sections[0].tasks.length && model.sections.length > 1) model.sections.shift();
  return model;
}
