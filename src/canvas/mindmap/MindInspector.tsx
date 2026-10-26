import { CornerDownRight, ListPlus, Network } from 'lucide-react';
import { mindDisplayText, MIND_SHAPES, type MindModel } from '../../diagrams/mindmap/model';
import { addChild, addSibling, deleteMind, findMind, keyAfterReparse, setMindText, updateMind } from '../../diagrams/mindmap/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { DeleteButton, Section } from '../../inspector/common';
import { useSelection } from '../../store/selection';
import { DraftInput, DraftTextarea, Field } from '../../ui/fields';
import { startEditing } from '../graph/context';

function NodePanel({ nodeKey }: { nodeKey: string }) {
  const t = useT();
  const { model, apply } = useDiagram<MindModel>();
  const loc = findMind(model.root, nodeKey);
  if (!loc) return null;
  const n = loc.node;
  const add = (kind: 'child' | 'sibling') => {
    const res = kind === 'child' ? addChild(model, nodeKey, t('mind.newIdea')) : addSibling(model, nodeKey, t('mind.newIdea'));
    const k = keyAfterReparse(res.model, res.key);
    apply(res.model);
    useSelection.getState().set([k]);
    setTimeout(() => startEditing(k), 80);
  };
  return (
    <>
      <Section title={t('mind.node')} icon={<Network size={14} />}>
        <Field label={t('inspector.label')}>
          <DraftTextarea value={mindDisplayText(n)} onCommit={(v) => v.trim() && apply(setMindText(model, nodeKey, v))} />
        </Field>
        <Field label={t('inspector.shape')}>
          <div className="chips">
            {MIND_SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${n.shape === s ? ' on' : ''}`}
                onClick={() => apply(updateMind(model, nodeKey, { shape: s }))}
              >
                {t(`mind.shape.${s}` as TranslationKey)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('mind.icon')}>
          <DraftInput mono value={n.icon ?? ''} placeholder="fa fa-book" onCommit={(v) => apply(updateMind(model, nodeKey, { icon: v.trim() || null }))} />
        </Field>
        <Field label={t('mind.class')}>
          <DraftInput mono value={n.cssClass ?? ''} onCommit={(v) => apply(updateMind(model, nodeKey, { cssClass: v.trim() || null }))} />
        </Field>
        <div className="field-row" style={{ marginTop: 4 }}>
          <button type="button" className="btn small" onClick={() => add('child')}>
            <CornerDownRight size={14} />
            {t('mind.addChild')}
          </button>
        </div>
        {loc.parent && (
          <div className="field-row" style={{ marginTop: 6 }}>
            <button type="button" className="btn small" onClick={() => add('sibling')}>
              <ListPlus size={14} />
              {t('mind.addSibling')}
            </button>
          </div>
        )}
      </Section>
      {loc.parent && (
        <Section title="">
          <DeleteButton
            onClick={() => {
              apply(deleteMind(model, [nodeKey]));
              useSelection.getState().clear();
            }}
          />
        </Section>
      )}
    </>
  );
}

export function MindInspector() {
  const t = useT();
  const ids = useSelection((s) => s.ids);
  const { model, apply } = useDiagram<MindModel>();
  if (ids.length === 1) return <NodePanel key={ids[0]} nodeKey={ids[0]} />;
  if (ids.length > 1) {
    return (
      <Section title={t('inspector.multi', { count: ids.length })}>
        <DeleteButton
          onClick={() => {
            apply(deleteMind(model, ids));
            useSelection.getState().clear();
          }}
        />
      </Section>
    );
  }
  return (
    <Section title={t('inspector.diagram')}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        {t('mind.hint')}
      </p>
    </Section>
  );
}
