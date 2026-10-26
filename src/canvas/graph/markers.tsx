export type MarkerName =
  | 'arrow'
  | 'arrow-open'
  | 'circle'
  | 'cross'
  | 'triangle'
  | 'diamond-filled'
  | 'diamond-hollow'
  | 'er-one'
  | 'er-zero-one'
  | 'er-one-many'
  | 'er-zero-many';

/** Shapes drawn pointing to +x with their tip at x = 0. */
function markerShape(name: MarkerName, color: string) {
  const s = { stroke: color, strokeWidth: 1.5, fill: 'none', strokeLinejoin: 'round' as const };
  const bg = 'var(--canvas)';
  switch (name) {
    case 'arrow':
      return <path d="M -10 -5 L 0 0 L -10 5 z" fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />;
    case 'arrow-open':
      return <path d="M -10 -6 L 0 0 L -10 6" {...s} />;
    case 'circle':
      return <circle cx={-5} cy={0} r={4.5} fill={color} />;
    case 'cross':
      return <path d="M -10 -5 L -2 5 M -10 5 L -2 -5" {...s} strokeWidth={2} />;
    case 'triangle':
      return <path d="M -14 -8 L 0 0 L -14 8 z" {...s} fill={bg} />;
    case 'diamond-filled':
      return <path d="M -18 0 L -9 -6 L 0 0 L -9 6 z" {...s} fill={color} />;
    case 'diamond-hollow':
      return <path d="M -18 0 L -9 -6 L 0 0 L -9 6 z" {...s} fill={bg} />;
    case 'er-one':
      return <path d="M -8 -7 L -8 7 M -14 -7 L -14 7" {...s} />;
    case 'er-zero-one':
      return (
        <>
          <path d="M -8 -7 L -8 7" {...s} />
          <circle cx={-19} cy={0} r={5} {...s} fill={bg} />
        </>
      );
    case 'er-one-many':
      return <path d="M 0 -7 L -10 0 L 0 7 M -10 0 L 0 0 M -14 -7 L -14 7" {...s} />;
    case 'er-zero-many':
      return (
        <>
          <path d="M 0 -7 L -10 0 L 0 7 M -10 0 L 0 0" {...s} />
          <circle cx={-16} cy={0} r={5} {...s} fill={bg} />
        </>
      );
  }
}

const NAMES: MarkerName[] = [
  'arrow',
  'arrow-open',
  'circle',
  'cross',
  'triangle',
  'diamond-filled',
  'diamond-hollow',
  'er-one',
  'er-zero-one',
  'er-one-many',
  'er-zero-many',
];

export const markerUrl = (name: MarkerName | null | undefined, selected = false) =>
  name ? `url(#mme-${name}${selected ? '-sel' : ''})` : undefined;

/** Marker definitions shared by every edge of a canvas. */
export function GraphMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        {NAMES.flatMap((name) =>
          [false, true].map((sel) => (
            <marker
              key={`${name}-${sel}`}
              id={`mme-${name}${sel ? '-sel' : ''}`}
              viewBox="-22 -10 24 20"
              refX={0}
              refY={0}
              markerWidth={24}
              markerHeight={20}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
              overflow="visible"
            >
              {markerShape(name, sel ? 'var(--accent)' : 'var(--edge)')}
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}
