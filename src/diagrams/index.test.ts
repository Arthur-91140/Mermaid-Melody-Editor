import { describe, expect, it } from 'vitest';
import { parseDocument, serializeDocument } from './index';

describe('document round-trip', () => {
  it('keeps frontmatter and directives around the regenerated body', () => {
    const code = `---
title: Hello
config:
  theme: forest
---
%%{init: {"flowchart": {"curve": "basis"}}}%%
flowchart LR
    A --> B`;
    const doc = parseDocument(code);
    expect(doc.kind).toBe('flowchart');
    expect(doc.preamble).toHaveLength(6);
    expect(serializeDocument(doc.preamble, doc.model!)).toBe(code);
  });

  it('returns no model for diagrams without a visual editor', () => {
    expect(parseDocument('pie title Pets\n  "Dogs" : 386').model).toBeNull();
  });
});
