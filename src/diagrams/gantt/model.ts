export const GANTT_TAGS = ['active', 'done', 'crit', 'milestone', 'vert'] as const;
export type GanttTag = (typeof GANTT_TAGS)[number];

export type GanttStart =
  | { kind: 'date'; value: string }
  | { kind: 'after'; ids: string[] }
  /** Starts when the previous task ends. */
  | { kind: 'prev' };

export type GanttEnd =
  | { kind: 'duration'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'until'; ids: string[] };

export interface GanttTask {
  /** Editor-only key. */
  key: string;
  name: string;
  id: string | null;
  tags: GanttTag[];
  start: GanttStart;
  end: GanttEnd;
  /** Original metadata when it could not be understood; written back verbatim. */
  raw: string | null;
}

export interface GanttSection {
  name: string | null;
  tasks: GanttTask[];
}

export const GANTT_SETTINGS = [
  'title',
  'dateFormat',
  'axisFormat',
  'tickInterval',
  'excludes',
  'includes',
  'todayMarker',
  'weekday',
  'weekend',
  'displayMode',
  'inclusiveEndDates',
  'topAxis',
] as const;
export type GanttSetting = (typeof GANTT_SETTINGS)[number];

export interface GanttModel {
  kind: 'gantt';
  /** Settings in source order, as [keyword, value]. */
  settings: [GanttSetting, string][];
  sections: GanttSection[];
  extras: string[];
}

export function getSetting(m: GanttModel, key: GanttSetting): string | null {
  for (let i = m.settings.length - 1; i >= 0; i--) if (m.settings[i][0] === key) return m.settings[i][1];
  return null;
}

export function setSetting(m: GanttModel, key: GanttSetting, value: string | null): GanttModel {
  const settings = m.settings.filter(([k]) => k !== key);
  if (value !== null) {
    const at = m.settings.findIndex(([k]) => k === key);
    settings.splice(at === -1 ? settings.length : at, 0, [key, value]);
  }
  return { ...m, settings };
}

export const allTasks = (m: GanttModel) => m.sections.flatMap((s) => s.tasks);
