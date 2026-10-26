import {
  ClipboardCopy,
  ClipboardPaste,
  CodeXml,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  FileUp,
  Image,
  Keyboard,
  Languages,
  Link,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Share2,
  Sun,
  Undo2,
  Braces,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { openDialog } from '../store/ui';
import { copyAs, copyShareLink, exportAs, importFiles, openInMermaidLive } from '../actions';
import { useParsed } from '../hooks/useDiagram';
import { useT, type TranslationKey } from '../i18n';
import { useDocuments } from '../store/documents';
import { useSettings, type AppTheme, type MermaidLook, type MermaidTheme } from '../store/settings';
import { Menu, MenuItem, MenuLabel, MenuSep } from '../ui/Menu';
import { KindIcon } from './KindIcon';

function DocTitle() {
  const t = useT();
  const currentId = useDocuments((s) => s.currentId);
  const name = useDocuments((s) => s.index.find((d) => d.id === s.currentId)?.name ?? '');
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const parsed = useParsed();
  return (
    <div className="doc-title">
      <input
        value={draft}
        aria-label={t('docs.rename')}
        size={Math.max(8, draft.length)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim();
          if (currentId && v && v !== name) useDocuments.getState().renameDoc(currentId, v);
          else setDraft(name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(name);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="kind-badge">
        <KindIcon kind={parsed.kind} size={12} />
        {t(`kind.${parsed.kind}` as TranslationKey)}
      </span>
    </div>
  );
}

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

export function TopBar() {
  const t = useT();
  const settings = useSettings();
  const canUndo = useDocuments((s) => s.past.length > 0);
  const canRedo = useDocuments((s) => s.future.length > 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const ThemeIcon = THEME_ICONS[settings.theme];

  return (
    <header className="topbar">
      <button
        type="button"
        className={`icon-btn${settings.showSidebar ? ' active' : ''}`}
        title={t('top.docs')}
        onClick={() => settings.set({ showSidebar: !settings.showSidebar })}
      >
        <PanelLeft size={17} />
      </button>
      <div className="brand">
        <img className="brand-logo" src="./favicon.svg" alt="" />
        <span className="brand-name">{t('app.name')}</span>
      </div>
      <span className="topbar-sep" />
      <DocTitle />
      <span className="topbar-spacer" />

      <button type="button" className="icon-btn" title={`${t('top.undo')} (Ctrl+Z)`} disabled={!canUndo} onClick={() => useDocuments.getState().undo()}>
        <Undo2 size={17} />
      </button>
      <button type="button" className="icon-btn" title={`${t('top.redo')} (Ctrl+Shift+Z)`} disabled={!canRedo} onClick={() => useDocuments.getState().redo()}>
        <Redo2 size={17} />
      </button>
      <span className="topbar-sep" />

      <button type="button" className="btn primary" onClick={() => openDialog('new')}>
        <Plus size={15} />
        <span className="hide-narrow">{t('top.new')}</span>
      </button>

      <Menu
        trigger={({ toggle }) => (
          <button type="button" className="btn" onClick={toggle} title={t('top.import')}>
            <FileUp size={15} />
            <span className="hide-narrow">{t('top.import')}</span>
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem close={close} icon={<FileUp size={15} />} label={t('import.file')} onSelect={() => fileInput.current?.click()} />
            <MenuItem close={close} icon={<ClipboardPaste size={15} />} label={t('import.paste')} onSelect={() => openDialog('paste')} />
          </>
        )}
      </Menu>
      <input
        ref={fileInput}
        type="file"
        accept=".mmd,.mermaid,.md,.markdown,.json,.txt"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <Menu
        align="end"
        trigger={({ toggle }) => (
          <button type="button" className="btn" onClick={toggle} title={t('top.export')}>
            <Download size={15} />
            <span className="hide-narrow">{t('top.export')}</span>
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem close={close} icon={<Image size={15} />} label={t('export.svg')} onSelect={() => exportAs('svg')} />
            <MenuItem close={close} icon={<Image size={15} />} label={t('export.png')} onSelect={() => exportAs('png')} />
            <MenuSep />
            <MenuItem close={close} icon={<FileCode size={15} />} label={t('export.mmd')} hint="Ctrl+S" onSelect={() => exportAs('mmd')} />
            <MenuItem close={close} icon={<FileText size={15} />} label={t('export.md')} onSelect={() => exportAs('md')} />
            <MenuItem close={close} icon={<Braces size={15} />} label={t('export.project')} onSelect={() => exportAs('project')} />
            <MenuSep />
            <MenuItem close={close} icon={<ClipboardCopy size={15} />} label={t('export.copyCode')} onSelect={() => copyAs('code')} />
            <MenuItem close={close} icon={<ClipboardCopy size={15} />} label={t('export.copyMarkdown')} onSelect={() => copyAs('markdown')} />
            <MenuItem close={close} icon={<CodeXml size={15} />} label={t('export.copySvg')} onSelect={() => copyAs('svg')} />
          </>
        )}
      </Menu>

      <Menu
        align="end"
        trigger={({ toggle }) => (
          <button type="button" className="btn" onClick={toggle} title={t('top.share')}>
            <Share2 size={15} />
            <span className="hide-narrow">{t('top.share')}</span>
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem close={close} icon={<Link size={15} />} label={t('share.copyLink')} onSelect={() => copyShareLink()} />
            <MenuItem close={close} icon={<ExternalLink size={15} />} label={t('share.openLive')} onSelect={openInMermaidLive} />
          </>
        )}
      </Menu>
      <span className="topbar-sep" />

      <Menu
        align="end"
        trigger={({ toggle }) => (
          <button type="button" className="icon-btn" onClick={toggle} title={t('preview.theme')}>
            <ThemeIcon size={17} />
          </button>
        )}
      >
        {(close) => (
          <>
            {(['light', 'dark', 'system'] as AppTheme[]).map((th) => {
              const Icon = THEME_ICONS[th];
              return (
                <MenuItem
                  key={th}
                  close={close}
                  icon={<Icon size={15} />}
                  checked={settings.theme === th}
                  label={t(`top.theme.${th}` as TranslationKey)}
                  onSelect={() => settings.set({ theme: th })}
                />
              );
            })}
            <MenuSep />
            <MenuLabel>{t('preview.theme')}</MenuLabel>
            {(['default', 'neutral', 'forest', 'dark', 'base'] as MermaidTheme[]).map((th) => (
              <MenuItem
                key={th}
                close={close}
                checked={settings.mermaidTheme === th}
                label={th}
                onSelect={() => settings.set({ mermaidTheme: th })}
              />
            ))}
            <MenuSep />
            <MenuLabel>{t('preview.look')}</MenuLabel>
            {(['classic', 'handDrawn'] as MermaidLook[]).map((l) => (
              <MenuItem
                key={l}
                close={close}
                checked={settings.look === l}
                label={t(`preview.look.${l}` as TranslationKey)}
                onSelect={() => settings.set({ look: l })}
              />
            ))}
          </>
        )}
      </Menu>

      <Menu
        align="end"
        trigger={({ toggle }) => (
          <button type="button" className="icon-btn" onClick={toggle} title={t('top.language')}>
            <Languages size={17} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem close={close} checked={settings.language === 'fr'} label="Français" onSelect={() => settings.set({ language: 'fr' })} />
            <MenuItem close={close} checked={settings.language === 'en'} label="English" onSelect={() => settings.set({ language: 'en' })} />
          </>
        )}
      </Menu>
      <button type="button" className="icon-btn hide-narrow" title={t('top.help')} onClick={() => openDialog('help')}>
        <Keyboard size={17} />
      </button>
      <button
        type="button"
        className={`icon-btn${settings.showCode ? ' active' : ''}`}
        title={t('top.code')}
        onClick={() => settings.set({ showCode: !settings.showCode })}
      >
        <CodeXml size={17} />
      </button>
      <button
        type="button"
        className={`icon-btn${settings.showInspector ? ' active' : ''}`}
        title={t('top.inspector')}
        onClick={() => settings.set({ showInspector: !settings.showInspector })}
      >
        <PanelRight size={17} />
      </button>
    </header>
  );
}
