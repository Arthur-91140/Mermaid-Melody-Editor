import { CircleAlert, CircleCheck } from 'lucide-react';
import { create } from 'zustand';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let nextId = 1;

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), kind === 'error' ? 5000 : 2800);
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.kind}`}>
          {x.kind === 'error' ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
          {x.text}
        </div>
      ))}
    </div>
  );
}
