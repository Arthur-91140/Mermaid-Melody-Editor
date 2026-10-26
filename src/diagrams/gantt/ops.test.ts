// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { allTasks } from './model';
import {
  addSection,
  addTask,
  deleteSection,
  deleteTasks,
  ensureTaskId,
  moveTask,
  moveTaskTo,
  renameTaskId,
  resizeTaskTo,
  taskKeyAfterReparse,
} from './ops';
import { parseGantt } from './parse';
import { schedule } from './schedule';
import { serializeGantt } from './serialize';

const parse = (code: string) => parseGantt(splitDocument(code).body);
const write = (m: ReturnType<typeof parse>) => {
  const s = serializeGantt(m);
  return [s.header, ...s.body].join('\n');
};
const base = `gantt
    dateFormat YYYY-MM-DD
    section A
    One :a1, 2024-03-04, 3d
    Two :after a1, 2d
    section B
    Three :b1, 2024-03-11, 2024-03-15`;

describe('gantt editing operations', () => {
  it('adds tasks and sections that Mermaid accepts', async () => {
    let m = addSection(parse(base), 'C');
    const r = addTask(m, 2, { name: 'Four', start: { kind: 'after', ids: ['b1'] }, end: { kind: 'duration', value: '1w' } });
    m = r.model;
    expect(taskKeyAfterReparse(m, r.key)).toBe('t3');
    const db = await mermaidDb(write(m));
    expect(db.getTasks().map((t: { task: string }) => t.task.trim())).toEqual(['One', 'Two', 'Three', 'Four']);
  });

  it('moves a task by date and keeps explicit end dates in step', () => {
    const m = parse(base);
    const s = schedule(m);
    const moved = moveTaskTo(m, 't2', new Date(2024, 2, 18), s[2].start);
    expect(allTasks(moved)[2]).toMatchObject({ start: { kind: 'date', value: '2024-03-18' }, end: { kind: 'date', value: '2024-03-22' } });
    const fromAfter = moveTaskTo(m, 't1', new Date(2024, 2, 20), s[1].start);
    expect(allTasks(fromAfter)[1].start).toEqual({ kind: 'date', value: '2024-03-20' });
  });

  it('resizes durations in days, counting working days when weekends are excluded', () => {
    const m = parse(base.replace('dateFormat YYYY-MM-DD', 'dateFormat YYYY-MM-DD\n    excludes weekends'));
    const s = schedule(m);
    // From Monday 4 to Monday 11: five working days.
    const r = resizeTaskTo(m, 't0', s[0].start, new Date(2024, 2, 11));
    expect(allTasks(r)[0].end).toEqual({ kind: 'duration', value: '5d' });
    const d = resizeTaskTo(m, 't2', s[2].start, new Date(2024, 2, 20));
    expect(allTasks(d)[2].end).toEqual({ kind: 'date', value: '2024-03-20' });
  });

  it('keeps references consistent when ids change or tasks go', () => {
    let m = renameTaskId(parse(base), 't0', 'start');
    expect(allTasks(m)[1].start).toEqual({ kind: 'after', ids: ['start'] });
    m = deleteTasks(m, ['t0']);
    expect(allTasks(m)[0].start).toEqual({ kind: 'prev' });
    const e = ensureTaskId(m, 't1');
    expect(e.id).toBe('t1');
    expect(moveTask(e.model, 't2', 0, 0).sections[0].tasks.map((t) => t.name)).toEqual(['Three', 'Two']);
    expect(deleteSection(m, 1).sections.map((s) => [s.name, s.tasks.length])).toEqual([['A', 2]]);
  });
});
