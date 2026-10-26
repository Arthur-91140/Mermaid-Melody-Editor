import type { Layout } from '../store/documents';
import { renderDiagram, type RenderOptions } from './mermaid';

export function slugify(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return s || 'diagram';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export function markdownBlock(code: string): string {
  return '```mermaid\n' + code + '\n```\n';
}

export async function exportSvg(code: string, opts: RenderOptions): Promise<string> {
  const svg = await renderDiagram(code, opts);
  return svg.startsWith('<?xml') ? svg : `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  const w = parseFloat(svg.getAttribute('width') ?? '') || 800;
  const h = parseFloat(svg.getAttribute('height') ?? '') || 600;
  return { width: w, height: h };
}

/** Renders the diagram to a PNG blob at `scale` times its natural size. */
export async function exportPng(code: string, opts: RenderOptions, background: string, scale = 2): Promise<Blob> {
  const raw = await renderDiagram(code, { ...opts, svgLabels: true });
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  const { width, height } = svgSize(svg);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.style.maxWidth = 'none';
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.decoding = 'async';
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG image could not be loaded'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

export interface ProjectFile {
  format: 'mermaid-melody-editor';
  version: 1;
  name: string;
  code: string;
  layout: Layout;
}

export function projectJson(name: string, code: string, layout: Layout): string {
  const data: ProjectFile = { format: 'mermaid-melody-editor', version: 1, name, code, layout };
  return JSON.stringify(data, null, 2);
}

export interface ImportedDiagram {
  name: string;
  code: string;
  layout?: Layout;
}

/** Reads diagrams from a .mmd, .md or project .json file's text. */
export function parseImport(filename: string, text: string): ImportedDiagram[] {
  const base = filename.replace(/\.[^.]+$/, '') || 'diagram';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) {
    const data = JSON.parse(text) as Partial<ProjectFile>;
    if (typeof data.code !== 'string') return [];
    return [{ name: data.name || base, code: data.code, layout: data.layout ?? {} }];
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const blocks = [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ''));
    return blocks.map((code, i) => ({ name: blocks.length > 1 ? `${base} ${i + 1}` : base, code }));
  }
  return text.trim() ? [{ name: base, code: text.replace(/\s+$/, '') }] : [];
}
