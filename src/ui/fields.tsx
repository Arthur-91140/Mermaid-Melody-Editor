import { useEffect, useRef, useState, type ReactNode } from 'react';

interface DraftProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  /** Returns an error message to block the commit. */
  validate?: (value: string) => string | null;
  autoFocus?: boolean;
  id?: string;
}

/** Text input that only commits on Enter or blur, so each edit is one undo step. */
export function DraftInput({ value, onCommit, placeholder, mono, validate, autoFocus, id }: DraftProps) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  const error = validate && draft !== value ? validate(draft) : null;
  const commit = () => {
    editing.current = false;
    if (draft !== value && !error) onCommit(draft);
    else setDraft(value);
  };
  return (
    <>
      <input
        id={id}
        className={`input${mono ? ' mono' : ''}${error ? ' invalid' : ''}`}
        value={draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(e) => {
          editing.current = true;
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            editing.current = false;
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {error && <span className="field-error">{error}</span>}
    </>
  );
}

/** Multi-line variant: commits on blur or Ctrl+Enter. */
export function DraftTextarea({ value, onCommit, placeholder, mono, rows = 3 }: DraftProps & { rows?: number }) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return (
    <textarea
      className={`textarea${mono ? ' mono' : ''}`}
      value={draft}
      rows={rows}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => {
        editing.current = true;
        setDraft(e.target.value);
      }}
      onBlur={() => {
        editing.current = false;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur();
        if (e.key === 'Escape') {
          editing.current = false;
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

interface Option<V extends string> {
  value: V;
  label: ReactNode;
  title?: string;
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: Option<V>[];
  onChange: (v: V) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as V)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function toPickerValue(v: string): string {
  if (!HEX.test(v)) return '#000000';
  if (v.length === 4) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  return v;
}

/** Color picker + text field; empty means "not set". Commits after a short pause. */
export function ColorField({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  const schedule = (v: string) => {
    setDraft(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v === '' || HEX.test(v) || /^[a-z]+$/i.test(v) || /^rgba?\(/.test(v)) onCommit(v);
    }, 350);
  };
  return (
    <div className="color-field">
      <input type="color" value={toPickerValue(draft || placeholder || '')} onChange={(e) => schedule(e.target.value)} />
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => schedule(e.target.value.trim())}
      />
    </div>
  );
}
