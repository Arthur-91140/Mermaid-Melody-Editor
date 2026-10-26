import dayjs from 'dayjs';
import { CalendarRange, FolderOpen } from 'lucide-react';
import { GANTT_TAGS, allTasks, getSetting, setSetting, type GanttEnd, type GanttModel, type GanttStart, type GanttTask } from '../../diagrams/gantt/model';
import { deleteSection, deleteTasks, ensureTaskId, moveTask, renameSection, renameTaskId, TASK_ID_RE, taskIdTaken, updateTask } from '../../diagrams/gantt/ops';
import { calendarOf, parseDate, parseDuration, schedule } from '../../diagrams/gantt/schedule';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { DeleteButton, Section } from '../../inspector/common';
import { useSelection } from '../../store/selection';
import { useSettings } from '../../store/settings';
import { Check, DraftInput, Field, Segmented, Select } from '../../ui/fields';
import { ganttIds } from './ids';

const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD HH:mm', 'HH:mm'];
const AXIS_FORMATS = ['', '%d/%m', '%Y-%m-%d', '%b %d', '%d %b', '%H:%M', '%a %d'];
const UNITS = ['m', 'h', 'd', 'w'];

/** Rewrites explicit dates when the date format changes. */
function convertDates(m: GanttModel, from: string, to: string): GanttModel {
  const conv = (v: string) => {
    const d = dayjs(v, from, true);
    return d.isValid() ? d.format(to) : v;
  };
  return {
    ...m,
    sections: m.sections.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({
        ...t,
        start: t.start.kind === 'date' ? { ...t.start, value: conv(t.start.value) } : t.start,
        end: t.end.kind === 'date' ? { ...t.end, value: conv(t.end.value) } : t.end,
      })),
    })),
  };
}

function TaskPanel({ taskKey }: { taskKey: string }) {
  const t = useT();
  const lang = useSettings((s) => s.language);
  const { model, apply } = useDiagram<GanttModel>();
  const tasks = allTasks(model);
  const task = tasks.find((x) => x.key === taskKey);
  if (!task) return null;
  const cal = calendarOf(model);
  const sched = schedule(model).find((s) => s.key === taskKey);
  const set = (patch: Partial<GanttTask>) => apply(updateTask(model, taskKey, patch));
  const section = model.sections.findIndex((s) => s.tasks.some((x) => x.key === taskKey));
  const others = tasks.filter((x) => x.key !== taskKey);
  const fmtDate = (d: Date | undefined) => (d ? dayjs(d).format(cal.dateFormat) : '');

  /** References another task by id, giving it one first if needed. */
  const reference = (otherKey: string, build: (id: string) => Partial<GanttTask>) => {
    const res = ensureTaskId(model, otherKey);
    apply(updateTask(res.model, taskKey, build(res.id)));
  };

  const setStartKind = (kind: GanttStart['kind']) => {
    if (kind === 'date') set({ start: { kind: 'date', value: fmtDate(sched?.start) } });
    else if (kind === 'prev') set({ start: { kind: 'prev' }, id: task.id });
    else if (others.length) {
      const prevIdx = tasks.findIndex((x) => x.key === taskKey) - 1;
      reference((tasks[prevIdx] ?? others[0]).key, (id) => ({ start: { kind: 'after', ids: [id] } }));
    }
  };
  const setEndKind = (kind: GanttEnd['kind']) => {
    if (kind === 'duration') set({ end: { kind: 'duration', value: '1d' } });
    else if (kind === 'date') set({ end: { kind: 'date', value: fmtDate(sched?.end) } });
    else if (others.length) reference(others[0].key, (id) => ({ end: { kind: 'until', ids: [id] } }));
  };
  const dur = task.end.kind === 'duration' ? parseDuration(task.end.value) : null;
  const dateError = (v: string) => (parseDate(v, cal) ? null : `${t('gantt.invalid')} (${cal.dateFormat})`);

  return (
    <>
      <Section title={t('gantt.task')} icon={<CalendarRange size={14} />}>
        <Field label={t('gantt.name')}>
          <DraftInput value={task.name} onCommit={(v) => v.trim() && set({ name: v.trim().replace(/[:\n]/g, ' ') })} />
        </Field>
        <Field label={t('inspector.id')} hint={task.start.kind === 'prev' && task.id ? t('gantt.start.prev') : undefined}>
          <DraftInput
            mono
            value={task.id ?? ''}
            placeholder={sched?.id}
            validate={(v) => (v && !TASK_ID_RE.test(v) ? t('inspector.idInvalid') : v && v !== task.id && taskIdTaken(model, v) ? t('inspector.idTaken') : null)}
            onCommit={(v) => apply(renameTaskId(model, taskKey, v.trim() || null))}
          />
        </Field>
        {model.sections.length > 1 && (
          <Field label={t('gantt.section')}>
            <Select
              value={String(section)}
              onChange={(v) => apply(moveTask(model, taskKey, Number(v), Number.MAX_SAFE_INTEGER))}
              options={model.sections.map((s, i) => ({ value: String(i), label: s.name ?? '—' }))}
            />
          </Field>
        )}
        <Field label={t('gantt.tags')}>
          <div className="chips">
            {GANTT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`chip${task.tags.includes(tag) ? ' on' : ''}`}
                onClick={() => set({ tags: task.tags.includes(tag) ? task.tags.filter((x) => x !== tag) : GANTT_TAGS.filter((x) => x === tag || task.tags.includes(x)) })}
              >
                {t(`gantt.tag.${tag}` as TranslationKey)}
              </button>
            ))}
          </div>
        </Field>
      </Section>
      <Section title={t('gantt.start')}>
        <Segmented
          value={task.start.kind}
          onChange={setStartKind}
          options={(['date', 'after', 'prev'] as const).map((k) => ({ value: k, label: t(`gantt.start.${k}` as TranslationKey) }))}
        />
        <div style={{ marginTop: 8 }}>
          {task.start.kind === 'date' && <DraftInput mono value={task.start.value} validate={dateError} onCommit={(v) => set({ start: { kind: 'date', value: v.trim() } })} />}
          {task.start.kind === 'after' && (
            <div className="list-editor">
              {others.map((o) => {
                const on = !!o.id && (task.start as Extract<GanttStart, { kind: 'after' }>).ids.includes(o.id);
                return (
                  <Check
                    key={o.key}
                    checked={on}
                    label={o.name}
                    onChange={(v) => {
                      const ids = (task.start as Extract<GanttStart, { kind: 'after' }>).ids;
                      if (!v) {
                        const rest = ids.filter((x) => x !== o.id);
                        set({ start: rest.length ? { kind: 'after', ids: rest } : { kind: 'prev' } });
                      } else reference(o.key, (id) => ({ start: { kind: 'after', ids: [...ids, id] } }));
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        {sched && <p className="field-hint">{sched.start.toLocaleString(lang)}</p>}
      </Section>
      <Section title={t('gantt.end')}>
        <Segmented
          value={task.end.kind}
          onChange={setEndKind}
          options={(['duration', 'date', 'until'] as const).map((k) => ({ value: k, label: t(`gantt.end.${k}` as TranslationKey) }))}
        />
        <div style={{ marginTop: 8 }}>
          {task.end.kind === 'duration' && (
            <div className="field-row">
              <DraftInput
                value={dur ? String(dur[0]) : task.end.value}
                validate={(v) => (/^\d+(\.\d+)?$/.test(v.trim()) ? null : t('gantt.invalid'))}
                onCommit={(v) => set({ end: { kind: 'duration', value: `${v.trim()}${dur?.[1] ?? 'd'}` } })}
              />
              <Select
                value={(dur?.[1] as string) ?? 'd'}
                onChange={(u) => set({ end: { kind: 'duration', value: `${dur?.[0] ?? 1}${u}` } })}
                options={UNITS.map((u) => ({ value: u, label: u }))}
              />
            </div>
          )}
          {task.end.kind === 'date' && <DraftInput mono value={task.end.value} validate={dateError} onCommit={(v) => set({ end: { kind: 'date', value: v.trim() } })} />}
          {task.end.kind === 'until' && (
            <Select
              value={tasks.find((o) => o.id && (task.end as Extract<GanttEnd, { kind: 'until' }>).ids.includes(o.id))?.key ?? ''}
              onChange={(k) => reference(k, (id) => ({ end: { kind: 'until', ids: [id] } }))}
              options={others.map((o) => ({ value: o.key, label: o.name }))}
            />
          )}
        </div>
        {sched && <p className="field-hint">{sched.end.toLocaleString(lang)}</p>}
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            useSelection.getState().clear();
            apply(deleteTasks(model, [taskKey]));
          }}
        />
      </Section>
    </>
  );
}

function SectionPanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<GanttModel>();
  const s = model.sections[index];
  if (!s) return null;
  return (
    <>
      <Section title={t('gantt.section')} icon={<FolderOpen size={14} />}>
        <Field label={t('gantt.name')}>
          <DraftInput value={s.name ?? ''} onCommit={(v) => v.trim() && apply(renameSection(model, index, v.trim()))} />
        </Field>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            useSelection.getState().clear();
            apply(deleteSection(model, index));
          }}
        />
      </Section>
    </>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<GanttModel>();
  const dateFormat = getSetting(model, 'dateFormat') ?? 'YYYY-MM-DD';
  const excludes = (getSetting(model, 'excludes') ?? '').split(/[\s,]+/).filter(Boolean);
  const weekends = excludes.includes('weekends');
  const otherExcludes = excludes.filter((e) => e !== 'weekends');
  const setExcludes = (list: string[]) => apply(setSetting(model, 'excludes', list.length ? list.join(', ') : null));
  return (
    <Section title={t('inspector.diagram')}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        {t('gantt.hint')}
      </p>
      <Field label={t('gantt.title')}>
        <DraftInput value={getSetting(model, 'title') ?? ''} onCommit={(v) => apply(setSetting(model, 'title', v.trim() || null))} />
      </Field>
      <Field label={t('gantt.dateFormat')}>
        <Select
          value={DATE_FORMATS.includes(dateFormat) ? dateFormat : ''}
          onChange={(v) => v && apply(setSetting(convertDates(model, dateFormat, v), 'dateFormat', v))}
          options={[...(DATE_FORMATS.includes(dateFormat) ? [] : [{ value: '', label: dateFormat }]), ...DATE_FORMATS.map((f) => ({ value: f, label: f }))]}
        />
      </Field>
      <Field label={t('gantt.axisFormat')}>
        <Select
          value={AXIS_FORMATS.includes(getSetting(model, 'axisFormat') ?? '') ? (getSetting(model, 'axisFormat') ?? '') : ''}
          onChange={(v) => apply(setSetting(model, 'axisFormat', v || null))}
          options={AXIS_FORMATS.map((f) => ({ value: f, label: f || t('common.default') }))}
        />
      </Field>
      <Check checked={weekends} label={t('gantt.excludeWeekends')} onChange={(on) => setExcludes(on ? ['weekends', ...otherExcludes] : otherExcludes)} />
      <Field label={t('gantt.excludes')} hint="2024-12-25, friday…">
        <DraftInput value={otherExcludes.join(', ')} onCommit={(v) => setExcludes([...(weekends ? ['weekends'] : []), ...v.split(/[\s,]+/).filter(Boolean)])} />
      </Field>
      <Check
        checked={(getSetting(model, 'todayMarker') ?? '') !== 'off'}
        label={t('gantt.today')}
        onChange={(on) => apply(setSetting(model, 'todayMarker', on ? null : 'off'))}
      />
    </Section>
  );
}

export function GanttInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<GanttModel>();
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) {
    const parsed = ids.map(ganttIds.parse);
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
            useSelection.getState().clear();
            let next = deleteTasks(model, parsed.filter((p) => p.kind === 'task').map((p) => p.id));
            for (const i of parsed.filter((p) => p.kind === 'section').map((p) => Number(p.id)).sort((a, b) => b - a)) next = deleteSection(next, i);
            apply(next);
          }}
        />
      </Section>
    );
  }
  const p = ganttIds.parse(ids[0]);
  return p.kind === 'section' ? <SectionPanel key={ids[0]} index={Number(p.id)} /> : <TaskPanel key={ids[0]} taskKey={p.id} />;
}
