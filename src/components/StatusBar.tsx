import { CircleAlert, CircleCheck, HardDrive, LoaderCircle } from 'lucide-react';
import { useT } from '../i18n';
import { useDocuments } from '../store/documents';
import { useStatus } from '../store/status';

export function StatusBar() {
  const t = useT();
  const checking = useStatus((s) => s.checking);
  const error = useStatus((s) => s.error);
  const lines = useDocuments((s) => s.code.split('\n').length);
  const firstLine = error?.message.split('\n')[0] ?? '';

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
      <span className="status-item hide-narrow">{t('status.lines', { count: lines })}</span>
      <span className="status-item">
        <HardDrive size={13} />
        {t('docs.storedLocally')}
      </span>
    </footer>
  );
}
