import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, MessageSquare, StickyNote, User } from 'lucide-react';
import { decodeEntities } from '../../diagrams/common';
import { BRANCH_OF, MAIN_ARROWS, SEQ_ARROWS, type BlockKind, type NotePosition, type SeqItem, type SeqModel } from '../../diagrams/sequence/model';
import {
  addBranch,
  blockOf,
  deleteItems,
  deleteParticipants,
  hasAutonumber,
  moveItem,
  moveParticipant,
  PARTICIPANT_ID_RE,
  participantTaken,
  renameParticipant,
  toggleAutonumber,
  updateItem,
  updateParticipant,
} from '../../diagrams/sequence/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { tryT, useT, type TranslationKey } from '../../i18n';
import { DeleteButton, IdField, Section } from '../../inspector/common';
import { useSelection } from '../../store/selection';
import { Check, DraftInput, DraftTextarea, Field, Segmented, Select } from '../../ui/fields';
import { BLOCK_KINDS, seqIds } from './ids';

const TYPES = ['', 'boundary', 'control', 'entity', 'database', 'collections', 'queue'];
const display = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, '\n'));
const encode = (s: string) => s.replace(/\r?\n/g, '<br>').replace(/;/g, '#59;').replace(/#(?!\w+;)/g, '#35;');

function ParticipantPanel({ id }: { id: string }) {
  const t = useT();
  const { model, apply } = useDiagram<SeqModel>();
  const index = model.participants.findIndex((x) => x.id === id);
  const p = model.participants[index];
  if (!p) return null;
  const type = /"type"\s*:\s*"(\w+)"/.exec(p.meta ?? '')?.[1] ?? '';
  return (
    <>
      <Section title={p.kind === 'actor' ? t('seq.actor') : t('seq.participant')} icon={<User size={14} />}>
        <IdField
          value={p.id}
          pattern={PARTICIPANT_ID_RE}
          isTaken={(v) => participantTaken(model, v)}
          onCommit={(v) => {
            useSelection.getState().set([seqIds.participant(v)]);
            apply(renameParticipant(model, p.id, v));
          }}
        />
        <Field label={t('seq.alias')}>
          <DraftInput value={p.label ?? ''} placeholder={p.id} onCommit={(v) => apply(updateParticipant(model, id, { label: v.trim() || null }))} />
        </Field>
        <Field label={t('seq.kind')}>
          <Segmented
            value={p.kind}
            onChange={(kind) => apply(updateParticipant(model, id, { kind }))}
            options={[
              { value: 'participant', label: t('seq.participant') },
              { value: 'actor', label: t('seq.actor') },
            ]}
          />
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={(v) => apply(updateParticipant(model, id, { meta: v ? `@{ "type": "${v}" }` : null }))}
            options={TYPES.map((x) => ({ value: x, label: x || t('common.default') }))}
          />
        </Field>
        <div className="field-row">
          <button type="button" className="btn small" disabled={index === 0} onClick={() => apply(moveParticipant(model, id, index - 1))}>
            <ArrowLeft size={14} />
            {t('seq.moveLeft')}
          </button>
          <button
            type="button"
            className="btn small"
            disabled={index === model.participants.length - 1}
            onClick={() => apply(moveParticipant(model, id, index + 1))}
          >
            {t('seq.moveRight')}
            <ArrowRight size={14} />
          </button>
        </div>
      </Section>
      <Section title="">
        <DeleteButton
          onClick={() => {
            useSelection.getState().clear();
            apply(deleteParticipants(model, [id]));
          }}
        />
      </Section>
    </>
  );
}

function ItemPanel({ index }: { index: number }) {
  const t = useT();
  const { model, apply } = useDiagram<SeqModel>();
  const it = model.items[index];
  if (!it) return null;
  const set = (patch: Partial<SeqItem>) => apply(updateItem(model, index, patch));
  const actors = model.participants.map((p) => ({ value: p.id, label: p.label ?? p.id }));
  const move = (to: number) => {
    const next = moveItem(model, index, to);
    if (next === model) return;
    useSelection.getState().set([seqIds.item(to)]);
    apply(next);
  };
  const remove = () => {
    useSelection.getState().clear();
    apply(deleteItems(model, [index]));
  };
  const moveButtons = (
    <div className="field-row" style={{ marginTop: 6 }}>
      <button type="button" className="btn small" disabled={index === 0} onClick={() => move(index - 1)}>
        <ArrowUp size={14} />
        {t('seq.moveUp')}
      </button>
      <button type="button" className="btn small" disabled={index === model.items.length - 1} onClick={() => move(index + 1)}>
        <ArrowDown size={14} />
        {t('seq.moveDown')}
      </button>
    </div>
  );

  let body: React.ReactNode = null;
  if (it.t === 'message') {
    const arrows = [...MAIN_ARROWS, ...SEQ_ARROWS.filter((a) => !MAIN_ARROWS.includes(a))];
    body = (
      <Section title={t('seq.message')} icon={<MessageSquare size={14} />}>
        <div className="field-row">
          <Field label={t('inspector.from')}>
            <Select value={it.from} options={actors} onChange={(from) => set({ from })} />
          </Field>
          <Field label={t('inspector.to')}>
            <Select value={it.to} options={actors} onChange={(to) => set({ to })} />
          </Field>
        </div>
        <Field label={t('inspector.label')}>
          <DraftTextarea rows={2} value={display(it.text)} onCommit={(v) => set({ text: encode(v.trim()) })} />
        </Field>
        <Field label={t('seq.arrow')}>
          <Select
            value={it.arrow}
            onChange={(arrow) => set({ arrow })}
            options={arrows.map((a) => ({ value: a, label: `${a}   ${tryT(t, `seq.arrow.${a}`, '')}` }))}
          />
        </Field>
        <Field label={t('seq.activation')}>
          <Select
            value={it.activate}
            onChange={(activate) => set({ activate: activate as '' | '+' | '-' })}
            options={[
              { value: '', label: t('seq.activation.none') },
              { value: '+', label: t('seq.activation.activate') },
              { value: '-', label: t('seq.activation.deactivate') },
            ]}
          />
        </Field>
        {moveButtons}
      </Section>
    );
  } else if (it.t === 'note') {
    body = (
      <Section title={t('seq.note')} icon={<StickyNote size={14} />}>
        <Field label={t('seq.position')}>
          <Segmented
            value={it.position}
            onChange={(position: NotePosition) => set({ position, actors: position === 'over' ? it.actors : it.actors.slice(0, 1) })}
            options={(['left of', 'right of', 'over'] as const).map((p) => ({ value: p, label: t(`seq.pos.${p}` as TranslationKey) }))}
          />
        </Field>
        <div className="field-row">
          <Field label={t('seq.participant')}>
            <Select value={it.actors[0]} options={actors} onChange={(a) => set({ actors: [a, ...it.actors.slice(1)] })} />
          </Field>
          {it.position === 'over' && (
            <Field label="+">
              <Select
                value={it.actors[1] ?? ''}
                options={[{ value: '', label: '—' }, ...actors]}
                onChange={(a) => set({ actors: a ? [it.actors[0], a] : [it.actors[0]] })}
              />
            </Field>
          )}
        </div>
        <Field label={t('inspector.label')}>
          <DraftTextarea value={display(it.text)} onCommit={(v) => set({ text: encode(v.trim()) })} />
        </Field>
        {moveButtons}
      </Section>
    );
  } else if (it.t === 'block') {
    const b = blockOf(model.items, index);
    body = (
      <Section title={t('seq.block')}>
        <Field label={t('seq.kind')}>
          <Select
            value={it.kind}
            onChange={(kind) => set({ kind: kind as BlockKind })}
            options={BLOCK_KINDS.map((k) => ({ value: k, label: `${k} — ${t(`seq.block.${k}` as TranslationKey)}` }))}
          />
        </Field>
        <Field label={it.kind === 'rect' ? t('inspector.fill') : t('seq.blockLabel')}>
          <DraftInput value={it.label} onCommit={(label) => set({ label: label.trim() })} />
        </Field>
        {BRANCH_OF[it.kind] && b && (
          <button type="button" className="btn small" onClick={() => apply(addBranch(model, index, t('seq.blockLabel')))}>
            + {BRANCH_OF[it.kind]}
          </button>
        )}
      </Section>
    );
  } else if (it.t === 'branch') {
    body = (
      <Section title={it.kind}>
        <Field label={t('seq.blockLabel')}>
          <DraftInput value={it.label} onCommit={(label) => set({ label: label.trim() })} />
        </Field>
      </Section>
    );
  } else if (it.t === 'activate' || it.t === 'deactivate' || it.t === 'destroy') {
    body = (
      <Section title={it.t}>
        <Field label={t('seq.participant')}>
          <Select value={it.actor} options={actors} onChange={(actor) => set({ actor })} />
        </Field>
        {moveButtons}
      </Section>
    );
  } else if (it.t === 'raw') {
    body = (
      <Section title="Mermaid">
        <DraftInput mono value={it.text} onCommit={(text) => text.trim() && set({ text: text.trim() })} />
        {moveButtons}
      </Section>
    );
  } else {
    body = <Section title={it.t}>{moveButtons}</Section>;
  }
  return (
    <>
      {body}
      <Section title="">
        <DeleteButton onClick={remove} />
      </Section>
    </>
  );
}

function DiagramPanel() {
  const t = useT();
  const { model, apply } = useDiagram<SeqModel>();
  return (
    <Section title={t('inspector.diagram')}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        {t('seq.hint')}
      </p>
      <Field label={t('seq.title')}>
        <DraftInput value={model.title ?? ''} onCommit={(v) => apply({ ...model, title: v.trim() || null })} />
      </Field>
      <Check checked={hasAutonumber(model)} onChange={(on) => apply(toggleAutonumber(model, on))} label={t('seq.autonumber')} />
    </Section>
  );
}

export function SequenceInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<SeqModel>();
  if (!ids.length) return <DiagramPanel />;
  if (ids.length > 1) {
    const parsed = ids.map(seqIds.parse);
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
            useSelection.getState().clear();
            apply(
              deleteParticipants(
                deleteItems(
                  model,
                  parsed.filter((p) => p.kind === 'item').map((p) => Number(p.id)),
                ),
                parsed.filter((p) => p.kind === 'participant').map((p) => p.id),
              ),
            );
          }}
        />
      </Section>
    );
  }
  const p = seqIds.parse(ids[0]);
  return p.kind === 'participant' ? <ParticipantPanel key={ids[0]} id={p.id} /> : <ItemPanel key={ids[0]} index={Number(p.id)} />;
}
