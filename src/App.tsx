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
import { usePanelVisible } from './store/ui';
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

function useWindowWidth(): number {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

const MIN_CENTER = 420;

/** Shrinks side panels (code first) so that the canvas keeps a usable width. */
function fitPanels(width: number, panels: { code: number; inspector: number; sidebar: number }) {
  const out = { ...panels };
  let excess = out.code + out.inspector + out.sidebar + MIN_CENTER - width;
  const shrink = (key: keyof typeof out, min: number) => {
    if (excess <= 0 || !out[key]) return;
    const d = Math.min(excess, Math.max(0, out[key] - min));
    out[key] -= d;
    excess -= d;
  };
  shrink('code', 280);
  shrink('inspector', 250);
  shrink('sidebar', 190);
  return out;
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
  const winWidth = useWindowWidth();
  const showCode = usePanelVisible('code');
  const showInspector = usePanelVisible('inspector');
  const showSidebar = usePanelVisible('docs');
  const widths = fitPanels(winWidth, {
    code: showCode ? s.codeWidth : 0,
    inspector: showInspector ? s.inspectorWidth : 0,
    sidebar: showSidebar ? s.sidebarWidth : 0,
  });

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
        {showSidebar && (
          <>
            <Sidebar width={widths.sidebar} />
            <Splitter value={widths.sidebar} min={180} max={420} onChange={(v) => s.set({ sidebarWidth: v })} />
          </>
        )}
        {showCode && (
          <>
            <section className="pane code-pane" style={{ width: widths.code }}>
              <CodeEditor />
            </section>
            <Splitter value={widths.code} min={240} max={900} onChange={(v) => s.set({ codeWidth: v })} />
          </>
        )}
        <VisualPane />
        {showInspector && (
          <>
            <Splitter value={widths.inspector} min={240} max={520} direction={-1} onChange={(v) => s.set({ inspectorWidth: v })} />
            <Inspector width={widths.inspector} />
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
