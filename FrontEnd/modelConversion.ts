import {
  analyzeModelFeel,
  type BpmnModelerLike,
  type DmnModelerLike
} from './modelFeelAnalysis';
import type { ModelFeelAnalysisState } from './modelFeelAnalysisState';
import {
  prepareConversionVariables,
  type ConversionPurpose
} from './conversionPreflight';
import {
  formatModelFeelError,
  type ModelFeelError
} from './modelFeelErrors';
import { TranslationError } from './customErrors';
import { bpmnToPn } from './bpmnToDpnConversion/dbpmnToDpn';
import type { DPN } from './bpmnToDpnConversion/dpn';

interface ConversionOptions {
  bpmnModeler: BpmnModelerLike;
  dmnModeler: DmnModelerLike;
  state: Pick<
    ModelFeelAnalysisState,
    'getUserTypes' | 'getInitialValues' | 'setResult'
  >;
  purpose: ConversionPurpose;
}

export class ConversionValidationError extends Error {
  constructor(public readonly errors: ModelFeelError[]) {
    super(
      errors.length > 0
        ? 'Conversion blocked:\n' +
          errors.map(formatModelFeelError).join('\n')
        : 'Conversion blocked because the model analysis is invalid.'
    );

    this.name = 'ConversionValidationError';
  }
}

export async function buildDpnForConversion({
  bpmnModeler,
  dmnModeler,
  state,
  purpose
}: ConversionOptions): Promise<DPN> {
  const analysis = analyzeModelFeel({
    bpmnModeler,
    dmnModeler,
    variableTypes: state.getUserTypes()
  });

  state.setResult(analysis);

  const prepared = prepareConversionVariables(
    analysis,
    state.getInitialValues(),
    purpose
  );

  if (!prepared.ok) {
    throw new ConversionValidationError(prepared.errors);
  }

  return bpmnToPn(bpmnModeler, dmnModeler, prepared.variables);
}

export function formatConversionError(error: unknown): string {
  if (error instanceof TranslationError) {
    const details = Array.isArray(error.error)
      ? error.error
      : [error.error];

    return [
      error.message,
      ...details
        .filter(detail => detail !== undefined && detail !== null)
        .map(formatConversionError)
    ].join('\n');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string'
    ? error
    : 'An unknown conversion error occurred.';
}
