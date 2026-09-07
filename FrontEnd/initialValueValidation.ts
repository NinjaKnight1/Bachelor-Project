import type {
  ResolvedModelFeelVariable
} from './modelFeelAnalysis';

export type ModelFeelInitialValueDiagnosticCode =
  | 'initial-value-required'
  | 'initial-value-type-unresolved'
  | 'initial-value-invalid-number'
  | 'initial-value-invalid-boolean'
  | 'initial-value-quoted-string';

export interface ModelFeelInitialValueDiagnostic {
  code: ModelFeelInitialValueDiagnosticCode;
  variableName: string;
  value?: string;
  message: string;
}

const NUMBER_PATTERN =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const QUOTED_STRING_PATTERN =
  /^"(?:\\.|[^"\\])*"$/;

export function validateModelFeelInitialValue(
  variable: ResolvedModelFeelVariable,
  value: string | undefined
): ModelFeelInitialValueDiagnostic | undefined {
  if (
    variable.status !== 'resolved' ||
    variable.resolvedType === undefined
  ) {
    return {
      code: 'initial-value-type-unresolved',
      variableName: variable.name,
      value,
      message:
        `Resolve the type of "${variable.name}" ` +
        'before entering an initial value.'
    };
  }

  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return {
      code: 'initial-value-required',
      variableName: variable.name,
      value,
      message:
        `Enter an initial value for ` +
        `"${variable.name}".`
    };
  }

  if (variable.resolvedType === 'number') {
    if (
      !NUMBER_PATTERN.test(trimmedValue) ||
      !Number.isFinite(Number(trimmedValue))
    ) {
      return {
        code: 'initial-value-invalid-number',
        variableName: variable.name,
        value,
        message:
          `"${variable.name}" must have a ` +
          'valid numeric initial value.'
      };
    }

    return undefined;
  }

  if (variable.resolvedType === 'boolean') {
    if (
      trimmedValue !== 'true' &&
      trimmedValue !== 'false'
    ) {
      return {
        code: 'initial-value-invalid-boolean',
        variableName: variable.name,
        value,
        message:
          `"${variable.name}" must be either ` +
          'true or false.'
      };
    }

    return undefined;
  }

  if (QUOTED_STRING_PATTERN.test(trimmedValue)) {
    return {
      code: 'initial-value-quoted-string',
      variableName: variable.name,
      value,
      message:
        `Enter the initial string value for ` +
        `"${variable.name}" without quotes.`
    };
  }

  return undefined;
}
