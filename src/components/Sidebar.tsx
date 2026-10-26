import { Copy, Ellipsis, PanelLeftClose, Pencil, Plus, Search, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { newDocument, openDocument } from '../actions';
import { useT, type Translate } from '../i18n';
import { useDocuments, type DocMeta } from '../store/documents';
import { useSettings } from '../store/settings';
import { openDialog } from '../store/ui';
import { Menu, MenuItem, MenuSep } from '../ui/Menu';
import { KindIcon } from './KindIcon';

function relativeTime(ts: number, lang: string): string {
  const diff = (ts - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ];
  let unit: Intl.RelativeTimeFormatUnit = 'year';
  let div = 31557600;
  for (let i = 0; i < steps.length; i++) {
    if (Math.abs(diff) < steps[i][0]) {
      unit = steps[i][1];
      div = i === 0 ? 1 : steps[i - 1][0];
      break;
    }
  }
  return rtf.format(Math.round(diff / div), unit);
}

function DocItem({ doc, current, t }: { doc: DocMeta; current: boolean; t: Translate }) {
  const lang = useSettings((s) => s.language);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc.name);
  const store = useDocuments.getState;

  const finishRename = () => {
    setRenaming(false);
    const v = draft.trim();
    if (v && v !== doc.name) store().renameDoc(doc.id, v);
  };

  return (
    <div
      className={`doc-item${current ? ' current' : ''}`}
      onClick={() => !renaming && openDocument(doc.id)}
      onDoubleClick={() => {
        setDraft(doc.name);
        setRenaming(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !renaming) openDocument(doc.id);
        if (e.key === 'F2') {
          setDraft(doc.name);
          setRenaming(true);
        }
      }}
    >
      <span className="doc-item-icon">
        <KindIcon kind={doc.kind} size={15} />
      </span>
      <span className="doc-item-text">
        {renaming ? (
          <input
            className="input doc-item-rename"
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') finishRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <>
            <div className="doc-item-name">{doc.name}</div>
            <div className="doc-item-meta">{t('docs.updated', { when: relativeTime(doc.updatedAt, lang) })}</div>
          </>
        )}
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <Menu
          align="end"
          trigger={({ toggle }) => (
            <button type="button" className="icon-btn small" onClick={toggle} aria-label="…">
              <Ellipsis size={15} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                close={close}
                icon={<Pencil size={15} />}
                label={t('docs.rename')}
                hint="F2"
                onSelect={() => {
                  setDraft(doc.name);
                  setRenaming(true);
                }}
              />
              <MenuItem
                close={close}
                icon={<Copy size={15} />}
                label={t('docs.duplicate')}
                onSelect={() => store().duplicateDoc(doc.id, t('docs.copySuffix'))}
              />
              <MenuSep />
              <MenuItem
                close={close}
                icon={<Trash size={15} />}
                label={t('docs.delete')}
                onSelect={() => {
                  if (!window.confirm(t('docs.confirmDelete', { name: doc.name }))) return;
                  store().deleteDoc(doc.id);
                  if (!store().index.length) newDocument('flowchart', 'blank');
                }}
              />
            </>
          )}
        </Menu>
      </span>
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const index = useDocuments((s) => s.index);
  const currentId = useDocuments((s) => s.currentId);
  const width = useSettings((s) => s.sidebarWidth);
  const set = useSettings((s) => s.set);
  const [query, setQuery] = useState('');
  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? index.filter((d) => d.name.toLowerCase().includes(q)) : index;
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [index, query]);

  return (
    <aside className="pane sidebar" style={{ width }}>
      <div className="pane-header">
        <span>{t('docs.title')}</span>
        <span className="spacer" />
        <button type="button" className="icon-btn small" title={t('docs.new')} onClick={() => openDialog('new')}>
          <Plus size={16} />
        </button>
        <button type="button" className="icon-btn small" title={t('top.docs')} onClick={() => set({ showSidebar: false })}>
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="doc-search">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--faint)' }} />
          <input
            className="input"
            style={{ paddingLeft: 28 }}
            placeholder={t('docs.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="pane-body doc-list">
        {docs.length === 0 && <div className="inspector-empty">{t('docs.empty')}</div>}
        {docs.map((d) => (
          <DocItem key={d.id} doc={d} current={d.id === currentId} t={t} />
        ))}
      </div>
      <div className="sidebar-footer">{t('docs.storedLocally')}</div>
    </aside>
  );
}
