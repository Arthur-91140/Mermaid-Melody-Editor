import { CircleAlert, CircleCheck, HardDrive, LoaderCircle, WrapText } from 'lucide-react';
import { useT } from '../i18n';
import { useDocuments } from '../store/documents';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';
import { usePanelVisible } from '../store/ui';

export function StatusBar() {
  const t = useT();
  const checking = useStatus((s) => s.checking);
  const error = useStatus((s) => s.error);
  const lines = useDocuments((s) => s.code.split('\n').length);
  const firstLine = error?.message.split('\n')[0] ?? '';
  const showCode = usePanelVisible('code');
  const wrapCode = useSettings((s) => s.wrapCode);

  return (
    <footer className="statusbar">
      {checking ? (
        <span className="status-item">
          <LoaderCircle size={13} />
          {t('status.checking')}
        </span>
      ) : error ? (
        <span className="status-item error" title={error.message}>
          <CircleAlert size={13} />
          <span>
            {t('status.invalid')}
            {error.line ? ` (${t('status.line', { line: error.line })})` : ''} — {firstLine}
          </span>
        </span>
      ) : (
        <span className="status-item ok">
          <CircleCheck size={13} />
          {t('status.valid')}
        </span>
      )}
      <span style={{ flex: 1 }} />
      {showCode && (
        <button
          type="button"
          className={`status-item status-toggle${wrapCode ? ' active' : ''}`}
          aria-pressed={wrapCode}
          title={t(wrapCode ? 'status.wrapOff' : 'status.wrapOn')}
          onClick={() => useSettings.getState().set({ wrapCode: !wrapCode })}
        >
          <WrapText size={13} />
          {t('status.wrap')}
        </button>
      )}
      <span className="status-item hide-narrow">{t('status.lines', { count: lines })}</span>
      <span className="status-item">
        <HardDrive size={13} />
        {t('docs.storedLocally')}
      </span>
    </footer>
  );
}
