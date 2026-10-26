import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { allTasks, getSetting, type GanttModel, type GanttTask } from './model';

dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);

export interface ScheduledTask {
  key: string;
  /** Id written in the source, or the one Mermaid generates (`task1`, ...). */
  id: string;
  start: Date;
  end: Date;
  /** End drawn by Mermaid when excluded days are skipped. */
  renderEnd: Date;
  valid: boolean;
}

export interface GanttCalendar {
  dateFormat: string;
  excludes: string[];
  includes: string[];
  weekendStart: number;
  inclusive: boolean;
}

export function calendarOf(m: GanttModel): GanttCalendar {
  const list = (v: string | null) => (v ?? '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  return {
    dateFormat: (getSetting(m, 'dateFormat') ?? 'YYYY-MM-DD').trim(),
    excludes: list(getSetting(m, 'excludes')),
    includes: list(getSetting(m, 'includes')),
    weekendStart: (getSetting(m, 'weekend') ?? '').trim() === 'friday' ? 5 : 6,
    inclusive: getSetting(m, 'inclusiveEndDates') !== null,
  };
}

export function isExcluded(date: Dayjs, cal: GanttCalendar): boolean {
  if (cal.includes.includes(date.format(cal.dateFormat))) return false;
  const wd = date.isoWeekday();
  if (cal.excludes.includes('weekends') && (wd === cal.weekendStart || wd === cal.weekendStart + 1)) return true;
  if (cal.excludes.includes(date.format('dddd').toLowerCase())) return true;
  return cal.excludes.includes(date.format(cal.dateFormat));
}

export function parseDuration(s: string): [number, dayjs.ManipulateType] | null {
  const m = /^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(s.trim());
  return m ? [Number.parseFloat(m[1]), m[2] as dayjs.ManipulateType] : null;
}

export function parseDate(s: string, cal: GanttCalendar): Date | null {
  const d = dayjs(s.trim(), cal.dateFormat, true);
  if (d.isValid()) return d.toDate();
  const fallback = new Date(s.trim());
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDate(d: Date, cal: GanttCalendar): string {
  return dayjs(d).format(cal.dateFormat);
}

interface Row {
  task: GanttTask;
  id: string;
  index: number;
  start: Date | null;
  end: Date | null;
  renderEnd: Date | null;
  done: boolean;
  valid: boolean;
}

/** Computes task dates the way Mermaid's Gantt database does. */
export function schedule(m: GanttModel, now = new Date()): ScheduledTask[] {
  const cal = calendarOf(m);
  const today = dayjs(now).startOf('day').toDate();
  let auto = 0;
  const rows: Row[] = allTasks(m).map((task, index) => ({
    task,
    id: task.id ?? `task${++auto}`,
    index,
    start: null,
    end: null,
    renderEnd: null,
    done: false,
    valid: task.raw === null,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const resolveStart = (r: Row): Date | null | undefined => {
    const s = r.task.start;
    if (s.kind === 'prev') return r.index > 0 ? rows[r.index - 1].end : today;
    if (s.kind === 'after') {
      const refs = s.ids.map((id) => byId.get(id)).filter((x): x is Row => !!x);
      if (!refs.length) return today;
      if (refs.some((x) => !x.done)) return null;
      return new Date(Math.max(...refs.map((x) => x.end!.getTime())));
    }
    const d = parseDate(s.value, cal);
    if (!d) r.valid = false;
    return d ?? today;
  };

  const resolveEnd = (r: Row, start: Date): Date | null => {
    const e = r.task.end;
    if (e.kind === 'until') {
      const refs = e.ids.map((id) => byId.get(id)).filter((x): x is Row => !!x);
      if (!refs.length) return today;
      if (refs.some((x) => !x.done)) return null;
      return new Date(Math.min(...refs.map((x) => x.start!.getTime())));
    }
    const asDate = dayjs(e.value.trim(), cal.dateFormat, true);
    if (asDate.isValid()) return (cal.inclusive ? asDate.add(1, 'd') : asDate).toDate();
    const dur = parseDuration(e.value);
    if (!dur) {
      r.valid = false;
      return start;
    }
    const added = dayjs(start).add(dur[0], dur[1]);
    return added.isValid() ? added.toDate() : start;
  };

  const fixExcluded = (r: Row) => {
    const manualEnd = r.task.end.kind !== 'until' && dayjs(r.task.end.value, 'YYYY-MM-DD', true).isValid();
    if (!cal.excludes.length || manualEnd) return;
    let cursor = dayjs(r.start!).add(1, 'd');
    let end = dayjs(r.end!);
    let invalid = false;
    let renderEnd: Date | null = null;
    while (!cursor.isAfter(end)) {
      if (!invalid) renderEnd = end.toDate();
      invalid = isExcluded(cursor, cal);
      if (invalid) end = end.add(1, 'd');
      cursor = cursor.add(1, 'd');
    }
    r.end = end.toDate();
    r.renderEnd = renderEnd;
  };

  for (let pass = 0; pass < 11; pass++) {
    let all = true;
    for (const r of rows) {
      if (r.done) continue;
      const start = resolveStart(r);
      if (start) {
        const end = resolveEnd(r, start);
        if (end) {
          r.start = start;
          r.end = end;
          r.done = true;
          fixExcluded(r);
        }
      }
      all = all && r.done;
    }
    if (all) break;
  }

  return rows.map((r) => {
    const start = r.start ?? today;
    const end = r.end ?? start;
    return {
      key: r.task.key,
      id: r.id,
      start,
      end,
      renderEnd: r.renderEnd ?? end,
      valid: r.valid && r.done,
    };
  });
}
