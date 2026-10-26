import { ClipboardPaste, FilePlus, Keyboard } from 'lucide-react';
import { useState } from 'react';
import { openDialog, useUi } from '../store/ui';
import { importCode, newDocument } from '../actions';
import { useT, type TranslationKey } from '../i18n';
import { TEMPLATE_KINDS } from '../templates';
import { Modal } from '../ui/Modal';
import { KindIcon } from './KindIcon';

export function NewDiagramDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Modal title={t('new.title')} icon={<FilePlus size={18} />} onClose={onClose}>
      <div className="template-grid">
        {TEMPLATE_KINDS.map((kind) => (
          <div key={kind} className="template-card">
            <span className="template-card-icon">
              <KindIcon kind={kind} size={18} />
            </span>
            <span className="template-card-title">{t(`kind.${kind}` as TranslationKey)}</span>
            <div className="template-card-actions">
              <button
                type="button"
                className="btn small primary"
                onClick={() => {
                  newDocument(kind, 'example');
                  onClose();
                }}
              >
                {t('new.example')}
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  newDocument(kind, 'blank');
                  onClose();
                }}
              >
                {t('new.blank')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function PasteDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const submit = () => {
    if (!code.trim()) return;
    importCode(code);
    onClose();
  };
  return (
    <Modal
      title={t('import.pasteTitle')}
      icon={<ClipboardPaste size={18} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn primary" disabled={!code.trim()} onClick={submit}>
            {t('top.import')}
          </button>
        </>
      }
    >
      <p className="field-hint" style={{ marginTop: 0 }}>
        {t('import.pasteHint')}
      </p>
      <textarea
        className="textarea mono"
        rows={14}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
        }}
        placeholder={'flowchart LR\n    A --> B'}
      />
    </Modal>
  );
}

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const rows: [string[], TranslationKey][] = [
    [[`${mod}+Z`, `${mod}+Shift+Z`], 'help.undo'],
    [['Suppr', 'Backspace'], 'help.delete'],
    [[`${mod}+D`], 'help.duplicate'],
    [['F2'], 'help.rename'],
    [[`${mod}+A`], 'help.selectAll'],
    [[`${mod}+S`], 'help.save'],
  ];
  return (
    <Modal title={t('help.title')} icon={<Keyboard size={18} />} onClose={onClose} small>
      <div className="help-grid">
        {rows.map(([keys, label]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span style={{ display: 'flex', gap: 4 }}>
              {keys.map((k) => (
                <span key={k} className="kbd">
                  {k}
                </span>
              ))}
            </span>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>
      <p className="field-hint">{t('help.pan')}</p>
      <p className="field-hint">{t('help.zoom')}</p>
      <p className="field-hint">{t('help.multi')}</p>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  const close = () => openDialog(null);
  if (dialog === 'new') return <NewDiagramDialog onClose={close} />;
  if (dialog === 'paste') return <PasteDialog onClose={close} />;
  if (dialog === 'help') return <HelpDialog onClose={close} />;
  return null;
}
