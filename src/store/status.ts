import { create } from 'zustand';
import type { ValidationError } from '../lib/mermaid';

interface StatusState {
  checking: boolean;
  error: ValidationError | null;
  /** Last code that Mermaid accepted, used to keep the preview on screen while typing. */
  lastValidCode: string | null;
}

export const useStatus = create<StatusState>(() => ({ checking: false, error: null, lastValidCode: null }));
