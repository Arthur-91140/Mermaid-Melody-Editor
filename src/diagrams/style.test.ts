import { describe, expect, it } from 'vitest';
import { classStyles, getStyle, parseStyle, setStyle, visualStyle } from './style';

describe('style strings', () => {
  it('parses pairs and keeps commas inside parentheses', () => {
    expect(parseStyle('fill:rgb(1,2,3),stroke:#333;')).toEqual([
      ['fill', 'rgb(1,2,3)'],
      ['stroke', '#333'],
    ]);
  });

  it('sets, replaces and removes properties', () => {
    let s = setStyle(null, 'fill', '#fff');
    s = setStyle(s, 'stroke', '#000');
    s = setStyle(s, 'fill', '#eee');
    expect(s).toBe('stroke:#000,fill:#eee');
    expect(getStyle(s, 'fill')).toBe('#eee');
    expect(setStyle(setStyle(s, 'fill', ''), 'stroke', null)).toBeNull();
  });

  it('merges class definitions before the element style', () => {
    const defs = [
      { names: 'default', style: 'fill:#111' },
      { names: 'hot,warm', style: 'fill:#f00,color:#fff' },
    ];
    expect(visualStyle(...classStyles(defs, ['warm']), 'stroke-width:3px')).toEqual({
      fill: '#f00',
      color: '#fff',
      strokeWidth: '3px',
    });
  });
});
