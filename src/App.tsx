import { FileUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportAs, importFiles, openFromHash } from './actions';
import { CodeEditor } from './editor/CodeEditor';
import { Dialogs } from './components/dialogs';
import { Inspector } from './components/Inspector';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { VisualPane } from './components/VisualPane';
import { useValidation } from './hooks/useValidation';
import { translate, useT } from './i18n';
import { useDocuments } from './store/documents';
import { useSettings } from './store/settings';
import { templateCode } from './templates';
import { Splitter } from './ui/Splitter';
import { Toasts } from './ui/toast';

function useAppTheme() {
  const theme = useSettings((s) => s.theme);
  const language = useSettings((s) => s.language);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}

function isTextTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || !!node.closest('.cm-editor'));
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        exportAs('mmd');
        return;
      }
      if (isTextTarget(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useDocuments.getState().redo();
        else useDocuments.getState().undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useDocuments.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useFileDrop(): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, []);
  return over;
}

export default function App() {
  const t = useT();
  const s = useSettings();
  const [ready, setReady] = useState(false);
  useAppTheme();
  useValidation();
  useGlobalShortcuts();
  const dropping = useFileDrop();

  useEffect(() => {
    useDocuments.getState().init(() => {
      const lang = useSettings.getState().language;
      return { name: `${translate(lang, 'kind.flowchart')} 1`, code: templateCode('flowchart', lang, 'example') };
    });
    openFromHash();
    const onHash = () => openFromHash();
    window.addEventListener('hashchange', onHash);
    setReady(true);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!ready) return null;

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        {s.showSidebar && (
          <>
            <Sidebar />
            <Splitter value={s.sidebarWidth} min={180} max={420} onChange={(v) => s.set({ sidebarWidth: v })} />
          </>
        )}
        {s.showCode && (
          <>
            <section className="pane code-pane" style={{ width: s.codeWidth }}>
              <CodeEditor />
            </section>
            <Splitter value={s.codeWidth} min={240} max={900} onChange={(v) => s.set({ codeWidth: v })} />
          </>
        )}
        <VisualPane />
        {s.showInspector && (
          <>
            <Splitter value={s.inspectorWidth} min={240} max={520} direction={-1} onChange={(v) => s.set({ inspectorWidth: v })} />
            <Inspector />
          </>
        )}
        {dropping && (
          <div className="backdrop" style={{ pointerEvents: 'none' }}>
            <div className="empty-state" style={{ color: '#fff' }}>
              <FileUp size={40} />
              <h3 style={{ color: '#fff' }}>{t('import.file')}</h3>
            </div>
          </div>
        )}
      </main>
      <StatusBar />
      <Dialogs />
      <Toasts />
    </div>
  );
}
