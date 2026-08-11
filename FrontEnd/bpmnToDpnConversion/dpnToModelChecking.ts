import { VariableTypes } from '../translationOfADA';
import { DPN } from './dpn';

type ModelCheckingState = {
  id: number;
  name: string;
  initial: boolean;
  final: boolean;
};

type ModelCheckingTransition = {
  source: number;
  target: number;
  name: string;
  guard?: string;
  written: string[];
};

type ModelCheckingVariable = {
  name: string;
  initial: string | number | boolean;
  type: 'bool' | 'rat' | 'int';
};

export type ModelCheckingModel = {
  name: string;
  states: ModelCheckingState[];
  transitions: ModelCheckingTransition[];
  variables: ModelCheckingVariable[];
  property: string;
};

function markingKey(marking: Set<string>): string {
  return [...marking].sort().join('\u0000');
}

function markingName(marking: Set<string>): string {
  return [...marking].sort().join('');
}

function variablesWrittenBy(guard: string | null, variableNames: string[]): string[] {
  if (!guard) return [];

  return variableNames.filter(name => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^A-Za-z0-9_])${escapedName}'`).test(guard);
  });
}

function adaStringValues(dpn: DPN): Map<string, number> {
  const values = new Map<string, number>();
  const quotedValue = /"((?:\\.|[^"\\])*)"/g;

  // ADA represents FEEL string literals as integer constants in the order it
  // encounters them while parsing transition guards.
  dpn.transitions.forEach(transition => {
    if (!transition.guard) return;
    for (const match of transition.guard.matchAll(quotedValue)) {
      const value = match[1].replace(/\\"/g, '"');
      if (!values.has(value)) values.set(value, values.size);
    }
  });
  return values;
}

function modelCheckingVariables(dpn: DPN): ModelCheckingVariable[] {
  const stringValues = adaStringValues(dpn);
  return dpn.variables.map(variable => {
    if (variable.type === VariableTypes.boolean) {
      return { name: variable.name, initial: variable.value.trim().toLowerCase() === 'true', type: 'bool' };
    }
    if (variable.type === VariableTypes.number) {
      const initial = Number(variable.value);
      return { name: variable.name, initial: Number.isFinite(initial) ? initial : 0, type: 'rat' };
    }
    const initial = stringValues.get(variable.value);
    return { name: variable.name, initial: initial ?? 0, type: 'int' };
  });
}

/** Converts a DPN into ADA's model-checking/DDS JSON format. */
export function dpnToModelChecking(dpn: DPN): ModelCheckingModel {
  const incomingPlaces = new Map<string, string[]>();
  const outgoingPlaces = new Map<string, string[]>();
  dpn.transitions.forEach(transition => {
    incomingPlaces.set(transition.id, []);
    outgoingPlaces.set(transition.id, []);
  });
  dpn.arcs.forEach(arc => {
    if (dpn.transitions.has(arc.target) && dpn.places.has(arc.source)) incomingPlaces.get(arc.target)?.push(arc.source);
    if (dpn.transitions.has(arc.source) && dpn.places.has(arc.target)) outgoingPlaces.get(arc.source)?.push(arc.target);
  });

  const initialMarking = new Set(dpn.source.keys());
  const finalPlaces = new Set(dpn.sink.keys());
  const initialKey = markingKey(initialMarking);
  const stateIds = new Map<string, number>();
  const markings: Set<string>[] = [];
  const states: ModelCheckingState[] = [];
  const transitions: ModelCheckingTransition[] = [];
  const variableNames = dpn.variables.map(variable => variable.name);
  const addState = (marking: Set<string>): number => {
    const key = markingKey(marking);
    const existing = stateIds.get(key);
    if (existing !== undefined) return existing;
    const id = states.length;
    stateIds.set(key, id);
    markings.push(marking);
    states.push({
      id,
      name: markingName(marking),
      initial: key === initialKey,
      final: marking.size > 0 && [...marking].every(place => finalPlaces.has(place)),
    });
    return id;
  };

  addState(initialMarking);
  for (let index = 0; index < markings.length; index += 1) {
    const marking = markings[index];
    const source = addState(marking);
    dpn.transitions.forEach(transition => {
      const input = incomingPlaces.get(transition.id) ?? [];
      if (input.length === 0 || !input.every(place => marking.has(place))) return;
      const nextMarking = new Set(marking);
      input.forEach(place => nextMarking.delete(place));
      (outgoingPlaces.get(transition.id) ?? []).forEach(place => nextMarking.add(place));
      const output: ModelCheckingTransition = {
        source,
        target: addState(nextMarking),
        name: transition.name ?? transition.id,
        written: variablesWrittenBy(transition.guard, variableNames),
      };
      if (transition.guard) output.guard = transition.guard;
      transitions.push(output);
    });
  }

  return {
    name: 'BPMN/DMN model',
    states,
    transitions,
    variables: modelCheckingVariables(dpn),
    property: 'F sink',
  };
}

export function dpnToModelCheckingFile(dpn: DPN): string {
  return JSON.stringify(dpnToModelChecking(dpn), null, 2);
}
