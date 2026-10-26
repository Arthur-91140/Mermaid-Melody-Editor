import dayjs from 'dayjs';
import { FolderPlus, ListPlus } from 'lucide-react';
import { ganttIds } from '../canvas/gantt/ids';
import { allTasks, type GanttModel } from '../diagrams/gantt/model';
import {
  addSection,
  addTask,
  deleteSection,
  deleteTasks,
  ensureTaskId,
  moveTask,
  renameSection,
  taskKeyAfterReparse,
  updateTask,
} from '../diagrams/gantt/ops';
import { calendarOf, schedule } from '../diagrams/gantt/schedule';
import { tag, type PreviewEditing } from './types';

export const ganttPreview: PreviewEditing<GanttModel> = {
  annotate(svg, m) {
    const keyById = new Map(schedule(m).map((s) => [s.id, s.key]));
    svg.querySelectorAll('rect.task, text[id$="-text"]').forEach((el) => {
      const id = el.id.replace(/^mme-render-\d+-/, '').replace(/-text$/, '');
      const key = keyById.get(id);
      if (key) tag(el, ganttIds.task(key));
    });
    const named = m.sections.flatMap((s, i) => (s.name !== null ? [i] : []));
    svg.querySelectorAll('text.sectionTitle').forEach((el, k) => named[k] !== undefined && tag(el, ganttIds.section(named[k])));
  },

  textOf(m, cid) {
    const p = ganttIds.parse(cid);
    if (p.kind === 'section') return m.sections[Number(p.id)]?.name ?? null;
    return allTasks(m).find((x) => x.key === p.id)?.name ?? null;
  },

  commitText(m, cid, text) {
    const p = ganttIds.parse(cid);
    const value = text.trim().replace(/[:\n]/g, ' ');
    if (!value) return null;
    if (p.kind === 'section') return { model: renameSection(m, Number(p.id), value) };
    return { model: updateTask(m, p.id, { name: value }) };
  },

  remove(m, ids) {
    const parsed = ids.map(ganttIds.parse);
    let next = deleteTasks(m, parsed.filter((p) => p.kind === 'task').map((p) => p.id));
    for (const i of parsed.filter((p) => p.kind === 'section').map((p) => Number(p.id)).sort((a, b) => b - a)) next = deleteSection(next, i);
    return next;
  },

  /** Dragging a task onto another makes the second start after the first. */
  connect(m, from, to) {
    const a = ganttIds.parse(from);
    const b = ganttIds.parse(to);
    if (a.kind !== 'task' || b.kind !== 'task' || a.id === b.id) return null;
    const res = ensureTaskId(m, a.id);
    return { model: updateTask(res.model, b.id, { start: { kind: 'after', ids: [res.id] } }) };
  },

  addActions: (t) => [
    {
      id: 'task',
      title: t('gantt.addTask'),
      icon: <ListPlus size={16} />,
      run(m, selection) {
        const cal = calendarOf(m);
        const timeBased = /[Hhms]/.test(cal.dateFormat.replace(/MMM|MM|M/g, ''));
        const sel = selection.map(ganttIds.parse)[0];
        const tasks = allTasks(m);
        const selTask = sel?.kind === 'task' ? tasks.find((x) => x.key === sel.id) : undefined;
        const sectionOf = (key: string) => m.sections.findIndex((s) => s.tasks.some((x) => x.key === key));
        const section = selTask ? sectionOf(selTask.key) : sel?.kind === 'section' ? Number(sel.id) : m.sections.length - 1;
        let res = addTask(m, section, {
          name: t('gantt.newTask'),
          start: tasks.length ? { kind: 'prev' } : { kind: 'date', value: dayjs().format(cal.dateFormat) },
          end: { kind: 'duration', value: timeBased ? '30m' : '3d' },
        });
        if (selTask) {
          const pos = m.sections[section].tasks.findIndex((x) => x.key === selTask.key);
          res = { ...res, model: moveTask(res.model, res.key, section, pos + 1) };
        }
        const key = taskKeyAfterReparse(res.model, res.key);
        return { model: res.model, select: [ganttIds.task(key)], edit: ganttIds.task(key) };
      },
    },
    {
      id: 'section',
      title: t('gantt.addSection'),
      icon: <FolderPlus size={16} />,
      run(m) {
        const model = addSection(m, t('gantt.newSection'));
        const i = model.sections.length - 1;
        return { model, select: [ganttIds.section(i)], edit: ganttIds.section(i) };
      },
    },
  ],
};
