// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitDocument } from '../common';
import { mermaidDb } from '../testing/mermaidDb';
import { GANTT_CORPUS } from './corpus';
import { allTasks } from './model';
import { parseGantt } from './parse';
import { schedule } from './schedule';
import { serializeGantt } from './serialize';

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

async function snapshot(code: string) {
  const db = await mermaidDb(code);
  return {
    dateFormat: String(db.getDateFormat()).trim(),
    axisFormat: String(db.getAxisFormat()).trim(),
    excludes: db.getExcludes(),
    tasks: (db.getTasks() as Record<string, any>[]).map((t) => ({
      id: t.id,
      name: String(t.task).trim(),
      section: t.section,
      start: iso(t.startTime),
      end: iso(t.endTime),
      renderEnd: iso(t.renderEndTime ?? t.endTime),
      flags: ['done', 'active', 'crit', 'milestone'].filter((f) => t[f]),
    })),
  };
}

describe('gantt parser and scheduler agree with the Mermaid engine', () => {
  GANTT_CORPUS.forEach((code, i) => {
    it(`sample #${i}: computed dates match Mermaid's`, async () => {
      const m = parseGantt(splitDocument(code).body);
      const now = new Date();
      const mine = schedule(m, now);
      const snap = await snapshot(code);
      const tasks = allTasks(m);
      expect(
        mine.map((s, k) => ({
          id: s.id,
          name: tasks[k].name,
          section: m.sections.find((sec) => sec.tasks.includes(tasks[k]))!.name ?? '',
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          renderEnd: s.renderEnd.toISOString(),
          flags: ['done', 'active', 'crit', 'milestone'].filter((f) => tasks[k].tags.includes(f as never)),
        })),
      ).toEqual(snap.tasks);
    });

    it(`sample #${i}: regenerated code means the same thing to Mermaid`, async () => {
      const d = splitDocument(code);
      const s = serializeGantt(parseGantt(d.body));
      const regenerated = [...d.preamble, s.header, ...s.body].join('\n');
      expect(await snapshot(regenerated)).toEqual(await snapshot(code));
    });
  });
});
