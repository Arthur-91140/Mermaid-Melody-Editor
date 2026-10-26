import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';

interface ModalProps {
  title: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  small?: boolean;
  children: ReactNode;
}

export function Modal({ title, icon, onClose, footer, small, children }: ModalProps) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${small ? ' small' : ''}`} role="dialog" aria-modal="true">
        <div className="dialog-header">
          {icon}
          <span>{title}</span>
          <span className="spacer" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
