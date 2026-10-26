import type { Mermaid, MermaidConfig } from 'mermaid';
import type { MermaidLook, MermaidTheme } from '../store/settings';

let instance: Promise<Mermaid> | null = null;

/** Loads Mermaid on first use so that the editor shell starts quickly. */
export function loadMermaid(): Promise<Mermaid> {
  instance ??= import('mermaid').then((m) => m.default);
  return instance;
}

export interface RenderOptions {
  theme: MermaidTheme;
  look: MermaidLook;
  /** Use SVG text instead of HTML labels (needed for reliable PNG export). */
  svgLabels?: boolean;
}

export interface ValidationError {
  message: string;
  /** 1-based line number in the code, when Mermaid reports one. */
  line: number | null;
}

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

/** Mermaid keeps global state while rendering, so calls are serialized. */
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function configFor(opts: RenderOptions): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: opts.theme,
    look: opts.look,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    ...(opts.svgLabels ? { htmlLabels: false, flowchart: { htmlLabels: false } } : {}),
  };
}

export function errorInfo(err: unknown): ValidationError {
  const e = err as { message?: string; hash?: { loc?: { first_line?: number }; line?: number } } | undefined;
  const message = String(e?.message ?? err ?? 'Unknown error').trim();
  let line: number | null = null;
  const m = /on line (\d+)/i.exec(message);
  if (m) line = Number(m[1]);
  else if (e?.hash?.loc?.first_line) line = e.hash.loc.first_line;
  else if (typeof e?.hash?.line === 'number') line = e.hash.line + 1;
  return { message, line };
}

/**
 * Mermaid numbers lines after dropping the frontmatter, directives, comment
 * lines and leading blank lines. Maps such a line number back to the editor.
 */
export function sourceLine(code: string, reported: number): number {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const kept: number[] = [];
  let i = 0;
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((l, k) => k > 0 && l.trim() === '---');
    i = close === -1 ? 0 : close + 1;
  }
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('%%{')) {
      while (i < lines.length && !lines[i].includes('}%%')) i++;
      continue;
    }
    if (t.startsWith('%%')) continue;
    if (!kept.length && !t) continue;
    kept.push(i + 1);
  }
  return kept[reported - 1] ?? reported;
}

export function renderDiagram(code: string, opts: RenderOptions): Promise<string> {
  return exclusive(async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize(configFor(opts));
    const id = `mme-render-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      return svg;
    } finally {
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  });
}

/** Asks Mermaid whether the code is valid. Resolves to null when it is. */
export function validateDiagram(code: string): Promise<ValidationError | null> {
  return exclusive(async () => {
    const mermaid = await loadMermaid();
    try {
      await mermaid.parse(code);
      return null;
    } catch (err) {
      const info = errorInfo(err);
      return info.line ? { ...info, line: sourceLine(code, info.line) } : info;
    }
  });
}
