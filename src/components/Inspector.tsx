import { PanelRightClose } from 'lucide-react';
import { VISUAL_EDITORS } from '../canvas/registry';
import { useParsed } from '../hooks/useDiagram';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';

export function Inspector() {
  const t = useT();
  const parsed = useParsed();
  const set = useSettings((s) => s.set);
  const width = useSettings((s) => s.inspectorWidth);
  const editor = VISUAL_EDITORS[parsed.kind];
  const readOnly = (parsed.model as { readOnlyReason?: string | null } | null)?.readOnlyReason;
  const Body = editor && parsed.model && !readOnly ? editor.Inspector : null;
  return (
    <aside className="pane inspector" style={{ width }}>
      <div className="pane-header">
        <span>{t('inspector.title')}</span>
        <span className="spacer" />
        <button type="button" className="icon-btn small" title={t('inspector.title')} onClick={() => set({ showInspector: false })}>
          <PanelRightClose size={15} />
        </button>
      </div>
      <div className="pane-body">{Body ? <Body /> : <div className="inspector-empty">{t('inspector.nothing')}</div>}</div>
    </aside>
  );
}
