import { useEffect } from 'react';
import { validateDiagram } from '../lib/mermaid';
import { useDocuments } from '../store/documents';
import { useStatus } from '../store/status';

/** Keeps the Mermaid validation status in sync with the current code. */
export function useValidation() {
  const code = useDocuments((s) => s.code);
  useEffect(() => {
    let cancelled = false;
    useStatus.setState({ checking: true });
    const timer = setTimeout(async () => {
      const error = code.trim() ? await validateDiagram(code) : null;
      if (cancelled) return;
      useStatus.setState((s) => ({
        checking: false,
        error,
        lastValidCode: error ? s.lastValidCode : code,
      }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);
}
