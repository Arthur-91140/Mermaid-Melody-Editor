import { Columns2, Eye, MousePointer2, TriangleAlert } from 'lucide-react';
import { VISUAL_EDITORS } from '../canvas/registry';
import { useParsed } from '../hooks/useDiagram';
import { tryT, useT } from '../i18n';
import { useSettings, type ViewMode } from '../store/settings';
import { useStatus } from '../store/status';
import { Segmented } from '../ui/fields';
import { Preview } from './Preview';

function readOnlyReason(model: unknown): string | null {
  return (model as { readOnlyReason?: string | null } | null)?.readOnlyReason ?? null;
}

function VisualArea() {
  const t = useT();
  const parsed = useParsed();
  const error = useStatus((s) => s.error);
  const editor = VISUAL_EDITORS[parsed.kind];
  const reason = readOnlyReason(parsed.model);

  if (!editor || !parsed.model) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="banner info">
          <Eye size={15} />
          <span>
            {t('visual.unsupported')} {t('visual.unsupportedHint')}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Preview />
        </div>
      </div>
    );
  }
  if (reason) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="banner">
          <TriangleAlert size={15} />
          <span>{t('visual.readOnly', { reason: tryT(t, `visual.reason.${reason}`, reason) })}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Preview />
        </div>
      </div>
    );
  }
  const Canvas = editor.Canvas;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {error && (
        <div className="banner">
          <TriangleAlert size={15} />
          <span>{t('visual.parseError')}</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Canvas />
      </div>
    </div>
  );
}

export function VisualPane() {
  const t = useT();
  const parsed = useParsed();
  const hasEditor = !!VISUAL_EDITORS[parsed.kind] && !!parsed.model && !readOnlyReason(parsed.model);
  const view = useSettings((s) => s.view);
  const set = useSettings((s) => s.set);
  const options: { value: ViewMode; label: React.ReactNode }[] = [
    {
      value: 'visual',
      label: (
        <>
          <MousePointer2 size={14} /> <span className="hide-narrow">{t('view.visual')}</span>
        </>
      ),
    },
    {
      value: 'preview',
      label: (
        <>
          <Eye size={14} /> <span className="hide-narrow">{t('view.preview')}</span>
        </>
      ),
    },
    {
      value: 'split',
      label: (
        <>
          <Columns2 size={14} /> <span className="hide-narrow">{t('view.split')}</span>
        </>
      ),
    },
  ];
  return (
    <section className="center">
      <div className="view-tabs">
        <Segmented value={view} options={options} onChange={(v) => set({ view: v })} />
      </div>
      <div className={`view-body${view === 'split' && hasEditor ? ' split' : ''}`}>
        {view !== 'preview' && <VisualArea />}
        {(view === 'preview' || (view === 'split' && hasEditor)) && <Preview />}
      </div>
    </section>
  );
}
