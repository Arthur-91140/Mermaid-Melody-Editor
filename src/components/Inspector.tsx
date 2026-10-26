import { PanelRightClose } from 'lucide-react';
import { Suspense } from 'react';
import { VISUAL_EDITORS } from '../canvas/registry';
import { useParsed } from '../hooks/useDiagram';
import { useT } from '../i18n';
import { closePanel } from '../store/ui';

export function Inspector({ width }: { width: number }) {
  const t = useT();
  const parsed = useParsed();
  const editor = VISUAL_EDITORS[parsed.kind];
  const readOnly = (parsed.model as { readOnlyReason?: string | null } | null)?.readOnlyReason;
  const Body = editor && parsed.model && !readOnly ? editor.Inspector : null;
  return (
    <aside className="pane inspector" style={{ width }}>
      <div className="pane-header">
        <span>{t('inspector.title')}</span>
        <span className="spacer" />
        <button type="button" className="icon-btn small" title={t('inspector.title')} onClick={() => closePanel('inspector')}>
          <PanelRightClose size={15} />
        </button>
      </div>
      <div className="pane-body">
        {Body ? (
          <Suspense fallback={null}>
            <Body />
          </Suspense>
        ) : (
          <div className="inspector-empty">{t('inspector.nothing')}</div>
        )}
      </div>
    </aside>
  );
}
