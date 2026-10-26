import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface MenuProps {
  /** Renders the trigger; call `toggle` from its click handler. */
  trigger: (props: { toggle: () => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
}

export function Menu({ trigger, children, align = 'start' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useLayoutEffect(() => {
    if (!open || !anchor.current || !menu.current) return;
    const a = anchor.current.getBoundingClientRect();
    const m = menu.current.getBoundingClientRect();
    let left = align === 'end' ? a.right - m.width : a.left;
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    let top = a.bottom + 4;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, a.top - m.height - 4);
    setPos({ left, top });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('.menu-item')?.focus();
  }, [open]);

  return (
    <span className="menu-anchor" ref={anchor}>
      {trigger({ toggle, open })}
      {open &&
        createPortal(
          <div
            className="menu"
            role="menu"
            ref={menu}
            style={{ left: pos.left, top: pos.top }}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              const items = [...(menu.current?.querySelectorAll<HTMLElement>('.menu-item') ?? [])];
              const i = items.indexOf(document.activeElement as HTMLElement);
              const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
              next?.focus();
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </span>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  checked?: boolean;
  onSelect: () => void;
  close: () => void;
}

export function MenuItem({ icon, label, hint, checked, onSelect, close }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item${checked ? ' checked' : ''}`}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      {icon}
      <span>{label}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  );
}

export const MenuSep = () => <div className="menu-sep" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="menu-label">{children}</div>;
