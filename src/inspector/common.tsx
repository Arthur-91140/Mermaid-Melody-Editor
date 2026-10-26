import { Trash } from 'lucide-react';
import type { ReactNode } from 'react';
import { getStyle, setStyle } from '../diagrams/style';
import { useT } from '../i18n';
import { Check, ColorField, DraftInput, Field } from '../ui/fields';

export function Section({ title, icon, actions, children }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="inspector-section">
      <h4>
        {icon}
        {title}
        <span className="spacer" />
        {actions}
      </h4>
      {children}
    </div>
  );
}

export function DeleteButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button type="button" className="btn danger small" onClick={onClick}>
      <Trash size={14} />
      {label ?? t('inspector.delete')}
    </button>
  );
}

const ID_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_-]*$/u;

export function IdField({
  value,
  onCommit,
  isTaken,
  pattern = ID_RE,
}: {
  value: string;
  onCommit: (v: string) => void;
  isTaken: (v: string) => boolean;
  pattern?: RegExp;
}) {
  const t = useT();
  return (
    <Field label={t('inspector.id')}>
      <DraftInput
        mono
        value={value}
        onCommit={onCommit}
        validate={(v) => (!pattern.test(v) ? t('inspector.idInvalid') : v !== value && isTaken(v) ? t('inspector.idTaken') : null)}
      />
    </Field>
  );
}

export type StyleKey = 'fill' | 'stroke' | 'color' | 'stroke-width' | 'stroke-dasharray';

/** Edits common properties of a Mermaid style string. */
export function StyleEditor({
  style,
  onChange,
  keys = ['fill', 'stroke', 'color', 'stroke-width', 'stroke-dasharray'],
}: {
  style: string | null;
  onChange: (style: string | null) => void;
  keys?: StyleKey[];
}) {
  const t = useT();
  const set = (key: StyleKey, v: string | null) => onChange(setStyle(style, key, v));
  return (
    <>
      <div className="field-row">
        {keys.includes('fill') && (
          <Field label={t('inspector.fill')}>
            <ColorField value={getStyle(style, 'fill')} onCommit={(v) => set('fill', v)} placeholder="#ffffff" />
          </Field>
        )}
        {keys.includes('stroke') && (
          <Field label={t('inspector.stroke')}>
            <ColorField value={getStyle(style, 'stroke')} onCommit={(v) => set('stroke', v)} placeholder="#333333" />
          </Field>
        )}
      </div>
      <div className="field-row">
        {keys.includes('color') && (
          <Field label={t('inspector.color')}>
            <ColorField value={getStyle(style, 'color')} onCommit={(v) => set('color', v)} placeholder="#000000" />
          </Field>
        )}
        {keys.includes('stroke-width') && (
          <Field label={t('inspector.strokeWidth')}>
            <DraftInput
              value={getStyle(style, 'stroke-width')}
              placeholder="1px"
              onCommit={(v) => set('stroke-width', v.trim() ? (/^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v.trim()) : null)}
            />
          </Field>
        )}
      </div>
      {keys.includes('stroke-dasharray') && (
        <Check
          checked={!!getStyle(style, 'stroke-dasharray')}
          onChange={(on) => set('stroke-dasharray', on ? '5 5' : null)}
          label={t('inspector.dashed')}
        />
      )}
      {style && (
        <button type="button" className="btn ghost small" style={{ marginTop: 6 }} onClick={() => onChange(null)}>
          {t('inspector.resetStyle')}
        </button>
      )}
    </>
  );
}

/** Toggle chips for the class definitions available in the diagram. */
export function ClassChips({ available, active, onToggle }: { available: string[]; active: string[]; onToggle: (cls: string) => void }) {
  const t = useT();
  if (!available.length) return null;
  return (
    <Field label={t('inspector.classes')}>
      <div className="chips">
        {available.map((c) => (
          <button key={c} type="button" className={`chip${active.includes(c) ? ' on' : ''}`} onClick={() => onToggle(c)}>
            {c}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** Names declared by `classDef` lines (excluding `default`). */
export function classDefNames(defs: { names: string }[]): string[] {
  return [...new Set(defs.flatMap((d) => d.names.split(',').map((n) => n.trim())))].filter((n) => n && n !== 'default');
}
