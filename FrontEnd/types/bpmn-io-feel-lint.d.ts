declare module '@bpmn-io/feel-lint' {
  export type FeelLintDialect = 'expression' | 'unaryTests';

  export interface FeelLintVariable {
    name: string;
  }

  export interface FeelLintOptions {
    dialect?: FeelLintDialect;
    parserDialect?: 'camunda';
    builtins?: FeelLintVariable[];
    variables?: FeelLintVariable[];
    engines?: Record<string, string>;
  }

  export interface FeelLintDiagnostic {
    from: number;
    to: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    type?: string;
  }

  export function lintExpression(
    expression: string,
    options?: FeelLintOptions
  ): FeelLintDiagnostic[];
}