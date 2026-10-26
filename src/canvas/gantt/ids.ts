/** Canvas ids of Gantt elements: `task:` tasks (by key), `sec:` sections (by index). */
export const ganttIds = {
  task: (key: string) => `task:${key}`,
  section: (i: number) => `sec:${i}`,
  parse(cid: string): { kind: 'task' | 'section'; id: string } {
    return cid.startsWith('sec:') ? { kind: 'section', id: cid.slice(4) } : { kind: 'task', id: cid.slice(5) };
  },
};
