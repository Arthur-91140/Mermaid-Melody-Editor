import type { ClassModel } from './class/model';
import { parseClass } from './class/parse';
import { serializeClass } from './class/serialize';
import { splitDocument, type DiagramKind } from './common';
import type { ErModel } from './er/model';
import { parseEr } from './er/parse';
import { serializeEr } from './er/serialize';
import type { FlowModel } from './flowchart/model';
import { parseFlowchart } from './flowchart/parse';
import { serializeFlowchart } from './flowchart/serialize';
import type { GanttModel } from './gantt/model';
import { parseGantt } from './gantt/parse';
import { serializeGantt } from './gantt/serialize';
import type { MindModel } from './mindmap/model';
import { parseMindmap } from './mindmap/parse';
import { serializeMindmap } from './mindmap/serialize';
import type { SeqModel } from './sequence/model';
import { parseSequence } from './sequence/parse';
import { serializeSequence } from './sequence/serialize';
import type { StateModel } from './state/model';
import { parseState } from './state/parse';
import { serializeState } from './state/serialize';

export type DiagramModel = FlowModel | SeqModel | ClassModel | ErModel | StateModel | MindModel | GanttModel;

export interface ParsedDocument {
  kind: DiagramKind;
  keyword: string;
  preamble: string[];
  /** Null for diagram types without a visual editor. */
  model: DiagramModel | null;
  /** 0-based line index of the first body line. */
  bodyOffset: number;
}

export function parseDocument(code: string): ParsedDocument {
  const d = splitDocument(code);
  const base = { kind: d.kind, keyword: d.keyword, preamble: d.preamble, bodyOffset: d.bodyOffset };
  switch (d.kind) {
    case 'flowchart':
      return { ...base, model: parseFlowchart(d.keyword, d.headerRest, d.body) };
    case 'sequence':
      return { ...base, model: parseSequence(d.body) };
    case 'class':
      return { ...base, model: parseClass(d.keyword, d.body) };
    case 'er':
      return { ...base, model: parseEr(d.body) };
    case 'state':
      return { ...base, model: parseState(d.keyword, d.body) };
    case 'mindmap':
      return { ...base, model: parseMindmap(d.body) };
    case 'gantt':
      return { ...base, model: parseGantt(d.body) };
    default:
      return { ...base, model: null };
  }
}

function serializeModel(model: DiagramModel): { header: string; body: string[] } {
  switch (model.kind) {
    case 'flowchart':
      return serializeFlowchart(model);
    case 'sequence':
      return serializeSequence(model);
    case 'class':
      return serializeClass(model);
    case 'er':
      return serializeEr(model);
    case 'state':
      return serializeState(model);
    case 'mindmap':
      return serializeMindmap(model);
    case 'gantt':
      return serializeGantt(model);
  }
}

export function serializeDocument(preamble: string[], model: DiagramModel): string {
  const { header, body } = serializeModel(model);
  return [...preamble, header, ...body].join('\n');
}

export type { DiagramKind } from './common';
