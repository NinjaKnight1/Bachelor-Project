import type { ModelFeelAnalysisResult } from './modelFeelAnalysis';
import {
  collectModelFeelErrors,
  type ModelFeelError
} from './modelFeelErrors';
import { VariableTypes, type Variable } from './translationOfADA';

export enum ConversionPurpose {
  Pnml = 'pnml',
  ModelChecking = 'model-checking'
}

export type ConversionPreflightResult =
  | { ok: true; variables: Variable[] }
  | { ok: false; errors: ModelFeelError[] };

export function prepareConversionVariables(
  analysis: ModelFeelAnalysisResult,
  initialValues: Record<string, string>,
  purpose: ConversionPurpose = ConversionPurpose.ModelChecking
): ConversionPreflightResult {
  const errors = collectModelFeelErrors(analysis, initialValues)
    .filter(error =>
      purpose === ConversionPurpose.ModelChecking ||
      error.kind !== 'initial-value' ||
      error.code === 'initial-value-type-unresolved'
    );

  if (!analysis.valid || errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    variables: analysis.variables.map(variable => ({
      name: variable.name,
      // Validation above rejects unresolved or conflicting types.
      type: VariableTypes[variable.resolvedType!],
      // PNML ignores values, but the existing Variable type requires one.
      value: initialValues[variable.name] ?? ''
    }))
  };
}
