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
  type: 'bool' | 'rat' | 'string';
};

type ModelCheckingConstant = {
  name: string;
  domain: [];
  range: 'string';
};

export type ModelCheckingModel = {
  name: string;
  states: ModelCheckingState[];
  transitions: ModelCheckingTransition[];
  variables: ModelCheckingVariable[];
  property: string;
  functions?: ModelCheckingConstant[];
  facts?: string;
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

class AdaStringRegistry {
  private readonly symbols = new Map<string, string>();
  private prefix: string | undefined;

  constructor(private readonly reservedNames: string[]) {}

  register(value: string): string {
    const existing = this.symbols.get(value);
    if (existing !== undefined) return existing;

    if (this.prefix === undefined) {
      const candidates = [
        'string_',
        '_string_',
        ...Array.from(
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
          letter => `${letter}_string_`,
        ),
      ];

      // ADA's parser can consume a variable-name prefix before
      // recognizing a constant. Avoid prefix collisions as well.
      this.prefix = candidates.find(candidate =>
        this.reservedNames.every(name =>
          !candidate.startsWith(name) && !name.startsWith(candidate),
        ),
      );

      if (this.prefix === undefined) {
        throw new Error(
          'Cannot generate ADA string constants without identifier conflicts.',
        );
      }
    }

    const readableValue = value
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'value';

    const symbol = `${this.prefix}${readableValue}_${this.symbols.size}`;
    this.symbols.set(value, symbol);
    return symbol;
  }

  encodeExpression(expression: string): string {
    const encoded = expression.replace(
      /"(?:\\.|[^"\\])*"/g,
      literal => {
        let value: unknown;

        try {
          value = JSON.parse(literal);
        } catch {
          throw new Error(`Invalid string literal: ${literal}`);
        }

        if (typeof value !== 'string') {
          throw new Error(`Expected a string literal: ${literal}`);
        }

        return this.register(value);
      },
    );

    if (encoded.includes('"')) {
      throw new Error('Unterminated string literal in ADA expression.');
    }

    return encoded;
  }

  declarations(): ModelCheckingConstant[] {
    return [...this.symbols.values()].map(name => ({
      name,
      domain: [],
      range: 'string',
    }));
  }

  distinctness(): string | undefined {
    const names = [...this.symbols.values()];

    return names.length > 1
      ? `distinct(${names.join(', ')})`
      : undefined;
  }
}

function modelCheckingVariables(
  dpn: DPN,
  strings: AdaStringRegistry,
): ModelCheckingVariable[] {
  return dpn.variables.map(variable => {
    if (variable.type === VariableTypes.boolean) {
      return { name: variable.name, initial: variable.value.trim().toLowerCase() === 'true', type: 'bool' };
    }
    if (variable.type === VariableTypes.number) {
      const initial = Number(variable.value);
      return { name: variable.name, initial: Number.isFinite(initial) ? initial : 0, type: 'rat' };
    }
    return {
      name: variable.name,
      initial: strings.register(variable.value),
      type: 'string',
    };
  });
}

/** Converts a DPN into ADA's model-checking/DDS JSON format. */
export function dpnToModelChecking(
  dpn: DPN,
  property: string = 'F sink',
): ModelCheckingModel {
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

  const strings = new AdaStringRegistry([
    ...variableNames,
    ...states.map(state => state.name),
  ]);

  const variables = modelCheckingVariables(dpn, strings);

  const encodedTransitions = transitions.map(transition => {
    if (transition.guard === undefined) return transition;

    return {
      ...transition,
      guard: strings.encodeExpression(transition.guard),
    };
  });

  const encodedProperty = strings.encodeExpression(property);
  const functions = strings.declarations();
  const facts = strings.distinctness();

  return {
    name: 'BPMN/DMN model',
    states,
    transitions: encodedTransitions,
    variables,
    property: encodedProperty,
    ...(functions.length > 0 ? { functions } : {}),
    ...(facts !== undefined ? { facts } : {}),
  };
}

export function dpnToModelCheckingFile(dpn: DPN): string {
  return JSON.stringify(dpnToModelChecking(dpn), null, 2);
}
