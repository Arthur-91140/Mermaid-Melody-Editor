import { describe, expect, it } from 'vitest';
import { sourceLine } from './mermaid';

describe('error line mapping', () => {
  it('maps Mermaid line numbers back to the editor', () => {
    expect(sourceLine('flowchart LR\n  A --> B\n  B -->> C', 3)).toBe(3);
    expect(sourceLine('---\ntitle: T\n---\nflowchart LR\n  A --> B\n  B -->> C', 3)).toBe(6);
    expect(sourceLine('%%{init: {\n "theme":"forest"\n}}%%\nflowchart LR\n  A --> B\n  B -->> C', 3)).toBe(6);
    expect(sourceLine('\n\nflowchart LR\n  %% note\n  A --> B\n\n  B -->> C', 4)).toBe(7);
  });
});
