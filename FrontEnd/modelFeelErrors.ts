import type {
  ModelFeelAnalysisResult,
  ModelFeelDiagnostic,
  ModelFeelSource
} from './modelFeelAnalysis';

import {
  validateModelFeelInitialValue,
  type ModelFeelInitialValueDiagnostic,
  type ModelFeelInitialValueDiagnosticCode
} from './initialValueValidation';

export interface ModelFeelSourceError {
  kind: 'feel';
  code: ModelFeelDiagnostic['diagnostic']['code'];
  message: string;
  source: ModelFeelSource;
  from: number;
  to: number;
}

export interface ModelFeelConflictError {
  kind: 'conflict';
  message: string;
  variableName: string;
  sources: ModelFeelSource[];
}

export interface ModelFeelInitialValueError {
  kind: 'initial-value';
  code: ModelFeelInitialValueDiagnosticCode;
  message: string;
  variableName: string;
  value?: string;
}

export type ModelFeelError =
  | ModelFeelSourceError
  | ModelFeelConflictError
  | ModelFeelInitialValueError;

function formatModelFeelSource(
  source: ModelFeelSource
): string {
  if (
    source.origin ===
    'bpmn-gateway-condition'
  ) {
    return (
      `BPMN gateway "${source.gatewayId}", ` +
      `flow "${source.flowId}"`
    );
  }

  const prefix =
    `DMN decision "${source.decisionId}", ` +
    `table "${source.tableId}", `;

  const column = source.column + 1;

  switch (source.origin) {
    case 'dmn-input-header':
      return (
        prefix +
        `input header column ${column}`
      );

    case 'dmn-output-header':
      return (
        prefix +
        `output header column ${column}`
      );

    case 'dmn-input-cell':
      return (
        prefix +
        `input cell row ${(source.row ?? 0) + 1}, ` +
        `column ${column}`
      );

    case 'dmn-output-cell':
      return (
        prefix +
        `output cell row ${(source.row ?? 0) + 1}, ` +
        `column ${column}`
      );
  }
}

export function formatModelFeelError(
  error: ModelFeelError
): string {
  if (error.kind === 'feel') {
    return (
      `${formatModelFeelSource(error.source)}: ` +
      error.message
    );
  }

  if (error.kind === 'conflict') {
    const sources = error.sources
      .map(formatModelFeelSource)
      .join('; ');

    return (
      `Variable conflict: ${error.message}` +
      (
        sources
          ? ` Sources: ${sources}.`
          : ''
      )
    );
  }

  return `Initial value: ${error.message}`;
}

export function collectModelFeelErrors(
  result: ModelFeelAnalysisResult,
  initialValues: Record<string, string> = {}
): ModelFeelError[] {
  const feelErrors: ModelFeelSourceError[] =
    result.diagnostics.map(({
      source,
      diagnostic
    }) => ({
      kind: 'feel',
      code: diagnostic.code,
      message: diagnostic.message,
      source,
      from: diagnostic.from,
      to: diagnostic.to
    }));

  const conflictErrors:
    ModelFeelConflictError[] =
      result.conflicts.map(conflict => ({
        kind: 'conflict',
        message: conflict.message,
        variableName: conflict.variable.name,
        sources: conflict.sources
      }));

  const conflictingVariableNames = new Set(
    result.conflicts.map(
      conflict => conflict.variable.name
    )
  );

  const initialValueErrors:
    ModelFeelInitialValueError[] =
      result.variables
        .filter(
          variable =>
            !conflictingVariableNames.has(
              variable.name
            )
        )
        .map(variable =>
          validateModelFeelInitialValue(
            variable,
            initialValues[variable.name]
          )
        )
        .filter(
          (
            diagnostic
          ): diagnostic is ModelFeelInitialValueDiagnostic =>
            diagnostic !== undefined
        )
        .map(diagnostic => ({
          kind: 'initial-value',
          ...diagnostic
        }));

  return [
    ...feelErrors,
    ...conflictErrors,
    ...initialValueErrors
  ];
}
