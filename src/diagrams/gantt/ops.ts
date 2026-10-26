import dayjs from 'dayjs';
import { allTasks, type GanttModel, type GanttSection, type GanttTask } from './model';
import { calendarOf, formatDate, isExcluded, parseDuration, type GanttCalendar } from './schedule';

export const TASK_ID_RE = /^[A-Za-z_][\w-]*$/;

let fresh = 0;
const newKey = () => `new${Date.now().toString(36)}${fresh++}`;

/** Key the parser will give `key`'s task once the code is regenerated (source order). */
export function taskKeyAfterReparse(m: GanttModel, key: string): string {
  const i = allTasks(m).findIndex((t) => t.key === key);
  return i === -1 ? key : `t${i}`;
}

export function taskIdTaken(m: GanttModel, id: string): boolean {
  return allTasks(m).some((t) => t.id === id);
}

export function nextTaskId(m: GanttModel): string {
  let n = 1;
  while (taskIdTaken(m, `t${n}`)) n++;
  return `t${n}`;
}

function mapTasks(m: GanttModel, fn: (t: GanttTask) => GanttTask): GanttModel {
  return { ...m, sections: m.sections.map((s) => ({ ...s, tasks: s.tasks.map(fn) })) };
}

export function updateTask(m: GanttModel, key: string, patch: Partial<GanttTask>): GanttModel {
  return mapTasks(m, (t) => (t.key === key ? { ...t, ...patch, raw: null } : t));
}

export function addTask(m: GanttModel, sectionIndex: number, init: Partial<GanttTask> = {}): { model: GanttModel; key: string } {
  const key = newKey();
  const task: GanttTask = {
    key,
    name: init.name ?? 'Task',
    id: init.id ?? null,
    tags: init.tags ?? [],
    start: init.start ?? { kind: 'prev' },
    end: init.end ?? { kind: 'duration', value: '3d' },
    raw: null,
  };
  const sections = m.sections.length ? [...m.sections] : [{ name: null, tasks: [] }];
  const si = Math.max(0, Math.min(sectionIndex, sections.length - 1));
  sections[si] = { ...sections[si], tasks: [...sections[si].tasks, task] };
  return { model: { ...m, sections }, key };
}

/** Removes tasks; references to their ids fall back to "after the previous task". */
export function deleteTasks(m: GanttModel, keys: string[]): GanttModel {
  const set = new Set(keys);
  const goneIds = new Set(allTasks(m).filter((t) => set.has(t.key) && t.id).map((t) => t.id!));
  const fix = (t: GanttTask): GanttTask => {
    let next = t;
    if (t.start.kind === 'after') {
      const ids = t.start.ids.filter((id) => !goneIds.has(id));
      next = { ...next, start: ids.length ? { kind: 'after', ids } : { kind: 'prev' } };
    }
    if (t.end.kind === 'until') {
      const ids = t.end.ids.filter((id) => !goneIds.has(id));
      next = { ...next, end: ids.length ? { kind: 'until', ids } : { kind: 'duration', value: '1d' } };
    }
    return next;
  };
  return { ...m, sections: m.sections.map((s) => ({ ...s, tasks: s.tasks.filter((t) => !set.has(t.key)).map(fix) })) };
}

export function renameTaskId(m: GanttModel, key: string, id: string | null): GanttModel {
  const task = allTasks(m).find((t) => t.key === key);
  if (!task || (id && taskIdTaken(m, id) && task.id !== id)) return m;
  const old = task.id;
  const rename = (ids: string[]) => (old && id ? ids.map((x) => (x === old ? id : x)) : ids);
  return mapTasks(m, (t) => {
    let next = t.key === key ? { ...t, id } : t;
    if (next.start.kind === 'after') next = { ...next, start: { kind: 'after', ids: rename(next.start.ids) } };
    if (next.end.kind === 'until') next = { ...next, end: { kind: 'until', ids: rename(next.end.ids) } };
    return next;
  });
}

/** Gives a task an id (needed to reference it) and returns it. */
export function ensureTaskId(m: GanttModel, key: string): { model: GanttModel; id: string } {
  const task = allTasks(m).find((t) => t.key === key);
  if (task?.id) return { model: m, id: task.id };
  const id = nextTaskId(m);
  return { model: renameTaskId(m, key, id), id };
}

export function moveTask(m: GanttModel, key: string, sectionIndex: number, index: number): GanttModel {
  const task = allTasks(m).find((t) => t.key === key);
  if (!task) return m;
  const sections = m.sections.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.key !== key) }));
  const si = Math.max(0, Math.min(sectionIndex, sections.length - 1));
  const tasks = [...sections[si].tasks];
  tasks.splice(Math.max(0, Math.min(index, tasks.length)), 0, task);
  sections[si] = { ...sections[si], tasks };
  return { ...m, sections };
}

export function addSection(m: GanttModel, name: string): GanttModel {
  return { ...m, sections: [...m.sections.filter((s) => s.name !== null || s.tasks.length), { name, tasks: [] }] };
}

export function renameSection(m: GanttModel, index: number, name: string): GanttModel {
  return { ...m, sections: m.sections.map((s, i) => (i === index ? { ...s, name } : s)) };
}

/** Removes a section header; its tasks join the previous section. */
export function deleteSection(m: GanttModel, index: number): GanttModel {
  const sections: GanttSection[] = m.sections.map((s) => ({ ...s, tasks: [...s.tasks] }));
  const [removed] = sections.splice(index, 1);
  if (!removed) return m;
  if (removed.tasks.length) {
    if (index > 0) sections[index - 1].tasks.push(...removed.tasks);
    else sections.unshift({ name: null, tasks: removed.tasks });
  }
  return { ...m, sections };
}

/** Working days from `start` to `end` (calendar days when nothing is excluded). */
export function workingDays(start: Date, end: Date, cal: GanttCalendar): number {
  if (!cal.excludes.length) return Math.round(dayjs(end).diff(dayjs(start), 'day', true));
  let n = 0;
  for (let d = dayjs(start); d.isBefore(dayjs(end)); d = d.add(1, 'd')) if (!isExcluded(d, cal)) n++;
  return n;
}

function durationText(start: Date, end: Date, unitHint: string | null, cal: GanttCalendar): string {
  const ms = end.getTime() - start.getTime();
  if (unitHint === 'h' || unitHint === 'm' || (ms < 86400000 && unitHint !== 'd' && unitHint !== 'w')) {
    const minutes = Math.max(1, Math.round(ms / 60000));
    return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
  }
  return `${Math.max(1, workingDays(start, end, cal))}d`;
}

/** Moves a task so that it starts at `start` (keeping its length). */
export function moveTaskTo(m: GanttModel, key: string, start: Date, oldStart: Date): GanttModel {
  const task = allTasks(m).find((t) => t.key === key);
  if (!task) return m;
  const cal = calendarOf(m);
  const patch: Partial<GanttTask> = { start: { kind: 'date', value: formatDate(start, cal) } };
  if (task.end.kind === 'date') {
    const delta = start.getTime() - oldStart.getTime();
    const end = dayjs(task.end.value, cal.dateFormat, true);
    if (end.isValid()) patch.end = { kind: 'date', value: formatDate(new Date(end.valueOf() + delta), cal) };
  } else if (task.end.kind === 'until') {
    patch.end = { kind: 'duration', value: '1d' };
  }
  return updateTask(m, key, patch);
}

/** Changes the end of a task, expressed the same way as before when possible. */
export function resizeTaskTo(m: GanttModel, key: string, start: Date, end: Date): GanttModel {
  const task = allTasks(m).find((t) => t.key === key);
  if (!task || end <= start) return m;
  const cal = calendarOf(m);
  if (task.end.kind === 'date') return updateTask(m, key, { end: { kind: 'date', value: formatDate(end, cal) } });
  const unit = task.end.kind === 'duration' ? (parseDuration(task.end.value)?.[1] ?? null) : null;
  return updateTask(m, key, { end: { kind: 'duration', value: durationText(start, end, unit as string | null, cal) } });
}
