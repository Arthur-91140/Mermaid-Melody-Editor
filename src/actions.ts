import { detectKind, type DiagramKind } from './diagrams/common';
import { translate, type TranslationKey } from './i18n';
import {
  copyText,
  downloadBlob,
  downloadText,
  exportPng,
  exportSvg,
  markdownBlock,
  parseImport,
  projectJson,
  slugify,
} from './lib/files';
import { errorInfo } from './lib/mermaid';
import { decodeShare, mermaidLiveUrl, shareUrl } from './lib/share';
import { useDocuments } from './store/documents';
import { useSelection } from './store/selection';
import { useSettings } from './store/settings';
import { templateCode, type TemplateKind } from './templates';
import { toast } from './ui/toast';

const tr = (key: TranslationKey, vars?: Record<string, string | number>) =>
  translate(useSettings.getState().language, key, vars);

function currentName(): string {
  const { index, currentId } = useDocuments.getState();
  return index.find((d) => d.id === currentId)?.name ?? tr('docs.untitled');
}

export function defaultDocName(kind: DiagramKind): string {
  const base = tr(`kind.${kind}` as TranslationKey);
  const names = new Set(useDocuments.getState().index.map((d) => d.name));
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function newDocument(kind: TemplateKind, variant: 'blank' | 'example') {
  const lang = useSettings.getState().language;
  useDocuments.getState().createDoc(defaultDocName(kind), templateCode(kind, lang, variant));
  useSelection.getState().clear();
}

export function openDocument(id: string) {
  useDocuments.getState().openDoc(id);
  useSelection.getState().clear();
}

export async function importFiles(files: FileList | File[]) {
  let count = 0;
  for (const file of Array.from(files)) {
    try {
      const items = parseImport(file.name, await file.text());
      if (!items.length) {
        toast(tr('import.noDiagram'), 'error');
        continue;
      }
      for (const item of items) {
        useDocuments.getState().createDoc(item.name, item.code, item.layout);
        count++;
      }
      if (items.length === 1) toast(tr('import.done', { name: items[0].name }));
    } catch {
      toast(tr('import.failed'), 'error');
    }
  }
  if (count) useSelection.getState().clear();
}

export function importCode(code: string) {
  const items = parseImport('pasted.mmd', code);
  if (!items.length) return;
  useDocuments.getState().createDoc(defaultDocName(detectKind(items[0].code)), items[0].code);
  useSelection.getState().clear();
}

function renderOptions() {
  const s = useSettings.getState();
  return { theme: s.mermaidTheme, look: s.look };
}

export type ExportFormat = 'svg' | 'png' | 'mmd' | 'md' | 'project';

export async function exportAs(format: ExportFormat) {
  const { code, layout } = useDocuments.getState();
  const name = currentName();
  const base = slugify(name);
  try {
    let file = '';
    switch (format) {
      case 'svg':
        file = `${base}.svg`;
        downloadText(await exportSvg(code, renderOptions()), file, 'image/svg+xml');
        break;
      case 'png': {
        file = `${base}.png`;
        const bg = useSettings.getState().mermaidTheme === 'dark' ? '#1f2020' : '#ffffff';
        downloadBlob(await exportPng(code, renderOptions(), bg), file);
        break;
      }
      case 'mmd':
        file = `${base}.mmd`;
        downloadText(code + '\n', file);
        break;
      case 'md':
        file = `${base}.md`;
        downloadText(`# ${name}\n\n${markdownBlock(code)}`, file, 'text/markdown');
        break;
      case 'project':
        file = `${base}.json`;
        downloadText(projectJson(name, code, layout), file, 'application/json');
        break;
    }
    toast(tr('export.saved', { file }));
  } catch (err) {
    toast(tr('export.failed', { error: errorInfo(err).message.split('\n')[0] }), 'error');
  }
}

export type CopyFormat = 'code' | 'svg' | 'markdown';

export async function copyAs(format: CopyFormat) {
  const { code } = useDocuments.getState();
  try {
    if (format === 'code') await copyText(code);
    else if (format === 'markdown') await copyText(markdownBlock(code));
    else await copyText(await exportSvg(code, renderOptions()));
    toast(tr('export.copied'));
  } catch (err) {
    toast(tr('export.failed', { error: errorInfo(err).message.split('\n')[0] }), 'error');
  }
}

export async function copyShareLink() {
  const { code, layout } = useDocuments.getState();
  await copyText(
    shareUrl({ code, layout, name: currentName(), mermaid: JSON.stringify({ theme: useSettings.getState().mermaidTheme }) }),
  );
  toast(tr('share.linkCopied'));
}

export function openInMermaidLive() {
  window.open(mermaidLiveUrl(useDocuments.getState().code, useSettings.getState().mermaidTheme), '_blank', 'noopener');
}

/** Opens a diagram passed in the URL hash (share link) as a new document. */
export function openFromHash(): boolean {
  const payload = decodeShare(window.location.hash);
  if (!payload) return false;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  const { index, code } = useDocuments.getState();
  const existing = index.find((d) => d.name === payload.name);
  if (existing && code === payload.code) return true;
  useDocuments.getState().createDoc(payload.name || tr('docs.untitled'), payload.code, payload.layout ?? {});
  toast(tr('share.opened'));
  return true;
}
