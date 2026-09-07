import {
  FeelAnalyzer,
  type InputVariable,
  type InvokedFunction
} from '@bpmn-io/feel-analyzer';

import {
  lintExpression,
  type FeelLintDiagnostic,
  type FeelLintVariable
} from '@bpmn-io/feel-lint';

import {
  camundaBuiltins,
  camundaReservedNameBuiltins
} from '@camunda/feel-builtins';

export type FeelExpressionKind = 'expression' | 'unaryTests';

export interface FeelAnalysisResult {
  valid: boolean;
  variables: InputVariable[];
  functions: InvokedFunction[];
  diagnostics: FeelLintDiagnostic[];
}

const analyzers: Record<FeelExpressionKind, FeelAnalyzer> = {
  expression: new FeelAnalyzer({
    dialect: 'expression',
    parserDialect: 'camunda',
    builtins: camundaBuiltins,
    reservedNameBuiltins: camundaReservedNameBuiltins
  }),

  unaryTests: new FeelAnalyzer({
    dialect: 'unaryTests',
    parserDialect: 'camunda',
    builtins: camundaBuiltins,
    reservedNameBuiltins: camundaReservedNameBuiltins
  })
};

export function analyzeFeelExpression(
  expression: string,
  kind: FeelExpressionKind = 'expression',
  knownVariables: FeelLintVariable[] = []
): FeelAnalysisResult {
  const diagnostics = lintExpression(expression, {
    dialect: kind,
    parserDialect: 'camunda',
    builtins: camundaBuiltins,
    variables: knownVariables
  });

  const analysis = analyzers[kind].analyzeExpression(expression);
  const hasError = diagnostics.some(
    diagnostic => diagnostic.severity === 'error'
  );

  return {
    valid: analysis.valid && !hasError,
    variables: analysis.inputs ?? [],
    functions: analysis.functions ?? [],
    diagnostics
  };
}