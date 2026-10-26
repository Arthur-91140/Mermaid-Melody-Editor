import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { GANTT_CORPUS } from './corpus';
import { allTasks, getSetting } from './model';
import { parseGantt } from './parse';
import { serializeGantt } from './serialize';

const parse = (code: string) => parseGantt(splitDocument(code).body);
const write = (code: string) => {
  const s = serializeGantt(parse(code));
  return [s.header, ...s.body].join('\n');
};
const strip = (code: string) => allTasks(parse(code)).map(({ key: _k, ...rest }) => rest);

describe('gantt parser', () => {
  it('reads settings, sections and task metadata', () => {
    const m = parse(GANTT_CORPUS[1]);
    expect(getSetting(m, 'dateFormat')).toBe('YYYY-MM-DD');
    expect(getSetting(m, 'excludes')).toBe('weekends');
    expect(m.sections.map((s) => s.name)).toEqual(['A section', 'Critical tasks', 'Documentation', 'Last section']);
    const tasks = allTasks(m);
    expect(tasks[0]).toMatchObject({
      name: 'Completed task',
      id: 'des1',
      tags: ['done'],
      start: { kind: 'date', value: '2014-01-06' },
      end: { kind: 'date', value: '2014-01-08' },
    });
    expect(tasks[2]).toMatchObject({ id: 'des3', start: { kind: 'after', ids: ['des2'] }, end: { kind: 'duration', value: '5d' } });
    expect(tasks[6]).toMatchObject({ id: null, tags: ['crit', 'active'], start: { kind: 'prev' } });
    expect(tasks[9]).toMatchObject({ end: { kind: 'until', ids: ['isadded'] } });
    expect(tasks[10]).toMatchObject({ id: 'isadded', tags: ['milestone'] });
  });

  GANTT_CORPUS.forEach((code, i) => {
    it(`sample #${i} round-trips to a stable form`, () => {
      const once = write(code);
      expect(write(once)).toBe(once);
      expect(strip(once)).toEqual(strip(code));
    });
  });
});
