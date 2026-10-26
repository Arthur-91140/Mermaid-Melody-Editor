import type { CSSProperties, ReactNode } from 'react';
import type { Boundary } from '../graph/geometry';

export interface ShapeInfo {
  boundary: Boundary;
  /** CSS padding around the label. */
  padding: string;
  /** Keeps width and height equal. */
  square?: boolean;
  /** Fixed size for shapes without a visible label. */
  fixed?: number;
  /** Shapes that do not display their label (junctions, bars). */
  noLabel?: boolean;
  minWidth?: number;
}

const DEFAULT: ShapeInfo = { boundary: 'rect', padding: '10px 18px', minWidth: 60 };

export const SHAPE_INFO: Record<string, ShapeInfo> = {
  rect: DEFAULT,
  rounded: DEFAULT,
  stadium: { boundary: 'rect', padding: '10px 24px', minWidth: 60 },
  'fr-rect': { boundary: 'rect', padding: '10px 24px', minWidth: 70 },
  cyl: { boundary: 'rect', padding: '20px 18px 12px', minWidth: 60 },
  circle: { boundary: 'ellipse', padding: '14px', square: true },
  'dbl-circ': { boundary: 'ellipse', padding: '18px', square: true },
  odd: { boundary: 'rect', padding: '10px 18px 10px 30px', minWidth: 70 },
  diam: { boundary: 'diamond', padding: '22px 34px', minWidth: 80 },
  hex: { boundary: 'rect', padding: '10px 32px', minWidth: 80 },
  'lean-r': { boundary: 'rect', padding: '10px 30px', minWidth: 80 },
  'lean-l': { boundary: 'rect', padding: '10px 30px', minWidth: 80 },
  'trap-b': { boundary: 'rect', padding: '10px 32px', minWidth: 80 },
  'trap-t': { boundary: 'rect', padding: '10px 32px', minWidth: 80 },
  doc: { boundary: 'rect', padding: '10px 18px 18px', minWidth: 70 },
  docs: { boundary: 'rect', padding: '14px 24px 20px 18px', minWidth: 70 },
  'lin-doc': { boundary: 'rect', padding: '10px 18px 18px 26px', minWidth: 70 },
  'tag-doc': { boundary: 'rect', padding: '10px 18px 18px', minWidth: 70 },
  delay: { boundary: 'rect', padding: '10px 30px 10px 18px', minWidth: 70 },
  'h-cyl': { boundary: 'rect', padding: '10px 30px', minWidth: 80 },
  'lin-cyl': { boundary: 'rect', padding: '24px 18px 12px', minWidth: 60 },
  'curv-trap': { boundary: 'rect', padding: '10px 30px', minWidth: 80 },
  'div-rect': { boundary: 'rect', padding: '22px 18px 10px', minWidth: 70 },
  tri: { boundary: 'rect', padding: '34px 30px 8px', minWidth: 80 },
  'flip-tri': { boundary: 'rect', padding: '8px 30px 34px', minWidth: 80 },
  'win-pane': { boundary: 'rect', padding: '18px 18px 10px 26px', minWidth: 70 },
  'f-circ': { boundary: 'ellipse', padding: '0', fixed: 16, noLabel: true },
  'sm-circ': { boundary: 'ellipse', padding: '0', fixed: 18, noLabel: true },
  'fr-circ': { boundary: 'ellipse', padding: '0', fixed: 24, noLabel: true },
  'cross-circ': { boundary: 'ellipse', padding: '0', fixed: 30, noLabel: true },
  fork: { boundary: 'rect', padding: '0', noLabel: true },
  hourglass: { boundary: 'rect', padding: '0', fixed: 30, noLabel: true },
  bolt: { boundary: 'rect', padding: '0', fixed: 34, noLabel: true },
  'lin-rect': { boundary: 'rect', padding: '10px 18px 10px 28px', minWidth: 70 },
  'notch-pent': { boundary: 'rect', padding: '16px 22px 10px', minWidth: 80 },
  'notch-rect': { boundary: 'rect', padding: '12px 18px 10px 22px', minWidth: 70 },
  'sl-rect': { boundary: 'rect', padding: '18px 18px 10px', minWidth: 70 },
  'tag-rect': DEFAULT,
  'bow-rect': { boundary: 'rect', padding: '10px 26px', minWidth: 80 },
  flag: { boundary: 'rect', padding: '16px 18px', minWidth: 70 },
  'st-rect': { boundary: 'rect', padding: '14px 24px 10px 18px', minWidth: 70 },
  brace: { boundary: 'rect', padding: '8px 14px', minWidth: 50 },
  'brace-r': { boundary: 'rect', padding: '8px 14px', minWidth: 50 },
  braces: { boundary: 'rect', padding: '8px 18px', minWidth: 50 },
  text: { boundary: 'rect', padding: '6px 8px', minWidth: 30 },
};

export const shapeInfo = (shape: string): ShapeInfo => SHAPE_INFO[shape] ?? DEFAULT;

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number | string;
  strokeDasharray?: string;
}

/** Document outline (wavy bottom edge) at (x, y). */
const docPath = (x: number, y: number, w: number, h: number, amp = 5) => {
  const b = y + h - amp;
  return `M ${x} ${y} H ${x + w} V ${b} C ${x + w * 0.75} ${b - amp * 2}, ${x + w * 0.55} ${b + amp * 1.5}, ${x + w * 0.3} ${b} S ${x + w * 0.08} ${b - amp}, ${x} ${b - amp * 0.6} Z`;
};

/** SVG elements drawing `shape` inside a `w` × `h` box. */
export function shapeElements(shape: string, w: number, h: number, paint: Paint): ReactNode {
  const p = { fill: paint.fill, stroke: paint.stroke, strokeWidth: paint.strokeWidth, strokeDasharray: paint.strokeDasharray };
  const line = { fill: 'none', stroke: paint.stroke, strokeWidth: paint.strokeWidth };
  const s = Math.min(h / 2, 22);
  switch (shape) {
    case 'rounded':
      return <rect x={0} y={0} width={w} height={h} rx={10} {...p} />;
    case 'stadium':
      return <rect x={0} y={0} width={w} height={h} rx={h / 2} {...p} />;
    case 'fr-rect':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} {...p} />
          <path d={`M 9 0 V ${h} M ${w - 9} 0 V ${h}`} {...line} />
        </>
      );
    case 'cyl':
    case 'lin-cyl': {
      const ry = Math.min(10, h * 0.18);
      return (
        <>
          <path d={`M 0 ${ry} A ${w / 2} ${ry} 0 0 0 ${w} ${ry} V ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`} {...p} />
          <ellipse cx={w / 2} cy={ry} rx={w / 2} ry={ry} {...p} />
          {shape === 'lin-cyl' && <path d={`M 0 ${ry * 2.4} A ${w / 2} ${ry} 0 0 0 ${w} ${ry * 2.4}`} {...line} />}
        </>
      );
    }
    case 'h-cyl': {
      const rx = Math.min(12, w * 0.15);
      return (
        <>
          <path d={`M ${rx} 0 H ${w - rx} A ${rx} ${h / 2} 0 0 1 ${w - rx} ${h} H ${rx} A ${rx} ${h / 2} 0 0 1 ${rx} 0 Z`} {...p} />
          <path d={`M ${w - rx} 0 A ${rx} ${h / 2} 0 0 0 ${w - rx} ${h}`} {...line} />
        </>
      );
    }
    case 'circle':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...p} />;
    case 'dbl-circ':
      return (
        <>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...p} />
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 5} ry={h / 2 - 5} {...line} />
        </>
      );
    case 'odd':
      return <path d={`M 0 0 H ${w} V ${h} H 0 L ${Math.min(14, h / 3)} ${h / 2} Z`} {...p} />;
    case 'diam':
      return <path d={`M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`} {...p} />;
    case 'hex':
      return <path d={`M ${s} 0 H ${w - s} L ${w} ${h / 2} L ${w - s} ${h} H ${s} L 0 ${h / 2} Z`} {...p} />;
    case 'lean-r':
      return <path d={`M ${s} 0 H ${w} L ${w - s} ${h} H 0 Z`} {...p} />;
    case 'lean-l':
      return <path d={`M 0 0 H ${w - s} L ${w} ${h} H ${s} Z`} {...p} />;
    case 'trap-b':
      return <path d={`M ${s} 0 H ${w - s} L ${w} ${h} H 0 Z`} {...p} />;
    case 'trap-t':
      return <path d={`M 0 0 H ${w} L ${w - s} ${h} H ${s} Z`} {...p} />;
    case 'doc':
    case 'lin-doc':
    case 'tag-doc':
      return (
        <>
          <path d={docPath(0, 0, w, h)} {...p} />
          {shape === 'lin-doc' && <path d={`M 9 0 V ${h - 3}`} {...line} />}
          {shape === 'tag-doc' && <path d={`M ${w - 16} ${h - 9} L ${w} ${h - 22}`} {...line} />}
        </>
      );
    case 'docs':
      return (
        <>
          <path d={docPath(8, 0, w - 8, h - 8, 4)} {...p} />
          <path d={docPath(4, 4, w - 8, h - 8, 4)} {...p} />
          <path d={docPath(0, 8, w - 8, h - 8, 4)} {...p} />
        </>
      );
    case 'delay':
      return <path d={`M 0 0 H ${w - h / 2} A ${h / 2} ${h / 2} 0 0 1 ${w - h / 2} ${h} H 0 Z`} {...p} />;
    case 'curv-trap':
      return <path d={`M ${s} 0 H ${w - h / 2} A ${h / 2} ${h / 2} 0 0 1 ${w - h / 2} ${h} H ${s} L 0 ${h / 2} Z`} {...p} />;
    case 'div-rect':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} {...p} />
          <path d={`M 0 14 H ${w}`} {...line} />
        </>
      );
    case 'tri':
      return <path d={`M ${w / 2} 0 L ${w} ${h} H 0 Z`} {...p} />;
    case 'flip-tri':
      return <path d={`M 0 0 H ${w} L ${w / 2} ${h} Z`} {...p} />;
    case 'win-pane':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} {...p} />
          <path d={`M 10 0 V ${h} M 0 10 H ${w}`} {...line} />
        </>
      );
    case 'f-circ':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={paint.stroke} stroke={paint.stroke} />;
    case 'sm-circ':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={paint.stroke} stroke={paint.stroke} />;
    case 'fr-circ':
      return (
        <>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...p} />
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 5} ry={h / 2 - 5} fill={paint.stroke} />
        </>
      );
    case 'cross-circ': {
      const r = w / 2;
      const d = r * Math.SQRT1_2;
      return (
        <>
          <ellipse cx={r} cy={h / 2} rx={r} ry={h / 2} {...p} />
          <path d={`M ${r - d} ${h / 2 - d} L ${r + d} ${h / 2 + d} M ${r + d} ${h / 2 - d} L ${r - d} ${h / 2 + d}`} {...line} />
        </>
      );
    }
    case 'fork':
      return <rect x={0} y={0} width={w} height={h} rx={2} fill={paint.stroke} />;
    case 'hourglass':
      return <path d={`M 0 0 H ${w} L 0 ${h} H ${w} Z`} {...p} />;
    case 'bolt':
      return <path d={`M ${w * 0.6} 0 L ${w * 0.15} ${h * 0.55} H ${w * 0.5} L ${w * 0.35} ${h} L ${w * 0.85} ${h * 0.42} H ${w * 0.5} Z`} {...p} />;
    case 'lin-rect':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} {...p} />
          <path d={`M 9 0 V ${h}`} {...line} />
        </>
      );
    case 'notch-pent':
      return <path d={`M ${s} 0 H ${w - s} L ${w} ${s} V ${h} H 0 V ${s} Z`} {...p} />;
    case 'notch-rect':
      return <path d={`M 12 0 H ${w} V ${h} H 0 V 12 Z`} {...p} />;
    case 'sl-rect':
      return <path d={`M 0 ${Math.min(14, h / 3)} L ${w} 0 V ${h} H 0 Z`} {...p} />;
    case 'tag-rect':
      return (
        <>
          <rect x={0} y={0} width={w} height={h} {...p} />
          <path d={`M ${w - 14} ${h} L ${w} ${h - 14}`} {...line} />
        </>
      );
    case 'bow-rect': {
      const r = Math.min(12, w * 0.12);
      return <path d={`M ${r} 0 H ${w} A ${r} ${h / 2} 0 0 0 ${w} ${h} H ${r} A ${r} ${h / 2} 0 0 1 ${r} 0 Z`} {...p} />;
    }
    case 'flag':
      return (
        <path
          d={`M 0 6 C ${w * 0.25} -2, ${w * 0.5} 14, ${w} 4 V ${h - 6} C ${w * 0.75} ${h + 2}, ${w * 0.5} ${h - 14}, 0 ${h - 4} Z`}
          {...p}
        />
      );
    case 'st-rect':
      return (
        <>
          <rect x={8} y={0} width={w - 8} height={h - 8} {...p} />
          <rect x={4} y={4} width={w - 8} height={h - 8} {...p} />
          <rect x={0} y={8} width={w - 8} height={h - 8} {...p} />
        </>
      );
    case 'brace':
      return <path d={`M 12 0 Q 2 0 2 10 V ${h / 2 - 6} Q 2 ${h / 2} -4 ${h / 2} Q 2 ${h / 2} 2 ${h / 2 + 6} V ${h - 10} Q 2 ${h} 12 ${h}`} {...line} />;
    case 'brace-r':
      return (
        <path
          d={`M ${w - 12} 0 Q ${w - 2} 0 ${w - 2} 10 V ${h / 2 - 6} Q ${w - 2} ${h / 2} ${w + 4} ${h / 2} Q ${w - 2} ${h / 2} ${w - 2} ${h / 2 + 6} V ${h - 10} Q ${w - 2} ${h} ${w - 12} ${h}`}
          {...line}
        />
      );
    case 'braces':
      return (
        <>
          {shapeElements('brace', w, h, paint)}
          {shapeElements('brace-r', w, h, paint)}
        </>
      );
    case 'text':
      return null;
    default:
      return <rect x={0} y={0} width={w} height={h} rx={2} {...p} />;
  }
}

/** Small preview used in palettes and the shape picker. */
export function ShapeIcon({ shape, size = 22 }: { shape: string; size?: number }) {
  const w = size * 1.4;
  const h = size;
  const info = shapeInfo(shape);
  const box = info.square || info.fixed ? { w: h, h } : shape === 'fork' ? { w, h: 6 } : { w, h };
  const style: CSSProperties = { overflow: 'visible' };
  return (
    <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={style} aria-hidden="true">
      <g transform={`translate(${(w - box.w) / 2} ${(h - box.h) / 2})`}>
        {shapeElements(shape, box.w, box.h, { fill: 'var(--node-fill)', stroke: 'currentColor', strokeWidth: 1.4 })}
        {shape === 'text' && (
          <text x={box.w / 2} y={box.h / 2 + 4} textAnchor="middle" fontSize={11} fill="currentColor">
            T
          </text>
        )}
      </g>
    </svg>
  );
}
