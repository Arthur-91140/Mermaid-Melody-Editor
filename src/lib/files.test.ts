import { describe, expect, it } from 'vitest';
import { parseImport, projectJson, slugify } from './files';

describe('file import', () => {
  it('reads every mermaid block of a Markdown file', () => {
    const md = '# Doc\n\n```mermaid\ngraph TD\n  A-->B\n```\n\ntext\n\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n';
    expect(parseImport('notes.md', md)).toEqual([
      { name: 'notes 1', code: 'graph TD\n  A-->B' },
      { name: 'notes 2', code: 'sequenceDiagram\n  A->>B: hi' },
    ]);
  });

  it('reads project files with their layout', () => {
    const json = projectJson('Mon schéma', 'graph LR\n  A', { A: { x: 3, y: 4 } });
    expect(parseImport('x.json', json)).toEqual([{ name: 'Mon schéma', code: 'graph LR\n  A', layout: { A: { x: 3, y: 4 } } }]);
  });

  it('reads plain .mmd files and builds safe file names', () => {
    expect(parseImport('flow.mmd', 'graph TD\n  A\n\n')).toEqual([{ name: 'flow', code: 'graph TD\n  A' }]);
    expect(slugify('Mon diagramme : été 2026')).toBe('mon-diagramme-ete-2026');
  });
});
