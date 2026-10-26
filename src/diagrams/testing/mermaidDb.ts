import mermaid from 'mermaid';

let initialized = false;

/** Parses `code` with Mermaid's own engine and returns its internal database (test-only). */
export async function mermaidDb(code: string): Promise<any> {
  if (!initialized) {
    mermaid.initialize({ startOnLoad: false });
    initialized = true;
  }
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
  return diagram.db;
}

export function sortBy<T>(items: T[], key: (t: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}
