import dayjs from 'dayjs';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface Step {
  ms: number;
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  count: number;
}

const STEPS: Step[] = [
  { ms: MIN, unit: 'minute', count: 1 },
  { ms: 5 * MIN, unit: 'minute', count: 5 },
  { ms: 15 * MIN, unit: 'minute', count: 15 },
  { ms: 30 * MIN, unit: 'minute', count: 30 },
  { ms: HOUR, unit: 'hour', count: 1 },
  { ms: 3 * HOUR, unit: 'hour', count: 3 },
  { ms: 6 * HOUR, unit: 'hour', count: 6 },
  { ms: 12 * HOUR, unit: 'hour', count: 12 },
  { ms: DAY, unit: 'day', count: 1 },
  { ms: 2 * DAY, unit: 'day', count: 2 },
  { ms: 7 * DAY, unit: 'week', count: 1 },
  { ms: 14 * DAY, unit: 'week', count: 2 },
  { ms: 30 * DAY, unit: 'month', count: 1 },
  { ms: 91 * DAY, unit: 'month', count: 3 },
  { ms: 365 * DAY, unit: 'year', count: 1 },
];

export interface Tick {
  t: number;
  label: string;
}

/** Ticks at least `minPx` apart for a scale of `pxPerMs`. */
export function ticks(t0: number, t1: number, pxPerMs: number, lang: string, axisFormat: string | null, minPx = 64): { ticks: Tick[]; step: Step } {
  const step = STEPS.find((s) => s.ms * pxPerMs >= minPx) ?? STEPS[STEPS.length - 1];
  let d = dayjs(t0);
  if (step.unit === 'minute') d = d.startOf('hour');
  else if (step.unit === 'hour') d = d.startOf('day');
  else if (step.unit === 'day') d = d.startOf('day');
  else if (step.unit === 'week') d = d.startOf('day').subtract((d.day() + 6) % 7, 'day');
  else if (step.unit === 'month') d = d.startOf('month');
  else d = d.startOf('year');
  const fmt = defaultFormat(step, lang);
  const out: Tick[] = [];
  for (let guard = 0; d.valueOf() <= t1 && guard < 2000; guard++) {
    if (d.valueOf() >= t0) out.push({ t: d.valueOf(), label: axisFormat ? strftime(axisFormat, d.toDate(), lang) : fmt.format(d.toDate()) });
    d = step.unit === 'week' ? d.add(7 * step.count, 'day') : d.add(step.count, step.unit);
  }
  return { ticks: out, step };
}

function defaultFormat(step: Step, lang: string): Intl.DateTimeFormat {
  if (step.ms < DAY) return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  if (step.ms < 30 * DAY) return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' });
  if (step.ms < 365 * DAY) return new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' });
  return new Intl.DateTimeFormat(lang, { year: 'numeric' });
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Subset of d3's time format, as used by Mermaid's `axisFormat`. */
export function strftime(fmt: string, d: Date, lang: string): string {
  const name = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, opts).format(d);
  return fmt.replace(/%([a-zA-Z%])/g, (_, c: string) => {
    switch (c) {
      case 'Y':
        return String(d.getFullYear());
      case 'y':
        return pad(d.getFullYear() % 100);
      case 'm':
        return pad(d.getMonth() + 1);
      case 'd':
        return pad(d.getDate());
      case 'e':
        return String(d.getDate());
      case 'H':
        return pad(d.getHours());
      case 'I':
        return pad(d.getHours() % 12 || 12);
      case 'M':
        return pad(d.getMinutes());
      case 'S':
        return pad(d.getSeconds());
      case 'p':
        return d.getHours() < 12 ? 'AM' : 'PM';
      case 'b':
        return name({ month: 'short' });
      case 'B':
        return name({ month: 'long' });
      case 'a':
        return name({ weekday: 'short' });
      case 'A':
        return name({ weekday: 'long' });
      case 'j':
        return pad(dayjs(d).diff(dayjs(d).startOf('year'), 'day') + 1, 3);
      case '%':
        return '%';
      default:
        return `%${c}`;
    }
  });
}

export { DAY, HOUR, MIN };
