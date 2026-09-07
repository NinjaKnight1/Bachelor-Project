import {
  FeelAnalyzer,
  type InputVariable
} from '@bpmn-io/feel-analyzer';

import { lintExpression } from '@bpmn-io/feel-lint';

import {
  camundaBuiltins,
  camundaReservedNameBuiltins
} from '@camunda/feel-builtins';

export type SupportedVariableType =
  | 'string'
  | 'number'
  | 'boolean';

export type SupportedSFeelKind =
  | 'expression'
  | 'unaryTests';

export type SupportedSFeelDiagnosticCode =
  | 'syntax-error'
  | 'type-required'
  | 'type-mismatch'
  | 'result-type-mismatch'
  | 'unary-test-type-mismatch'
  | 'unsupported-function'
  | 'unsupported-expression';

export interface SupportedSFeelVariable {
  name: string;
  possibleTypes: SupportedVariableType[];
}

export interface SupportedSFeelDiagnostic {
  code: SupportedSFeelDiagnosticCode;
  message: string;
  from: number;
  to: number;
  variable?: string;
}

export interface SupportedSFeelOptions {
  kind?: SupportedSFeelKind;
  variableTypes?: Record<string, SupportedVariableType>;
  expectedResultType?: SupportedVariableType;
  expectedUnaryTestInputType?: SupportedVariableType;
}

export interface SupportedSFeelResult {
  valid: boolean;
  variables: SupportedSFeelVariable[];
  possibleResultTypes: SupportedVariableType[];
  diagnostics: SupportedSFeelDiagnostic[];
}

const ALL_SUPPORTED_TYPES: SupportedVariableType[] = [
  'string',
  'number',
  'boolean'
];

const analyzers: Record<SupportedSFeelKind, FeelAnalyzer> = {
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

type FeelSyntaxNode =
  ReturnType<FeelAnalyzer['parser']['parse']>['topNode'];

function convertAnalyzerType(
  type: InputVariable['type']
): SupportedVariableType | undefined {
  switch (type) {
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    default:
      return undefined;
  }
}

function findChild(
  node: FeelSyntaxNode,
  typeName: string
): FeelSyntaxNode | undefined {
  let child = node.firstChild;

  while (child) {
    if (child.type.name === typeName) {
      return child;
    }

    child = child.nextSibling;
  }

  return undefined;
}

function unwrapNode(node: FeelSyntaxNode): FeelSyntaxNode {
  let currentNode = node;

  while (
    currentNode.type.name === 'PositionalParameters' ||
    currentNode.type.name === 'ParenthesizedExpression'
  ) {
    let child = currentNode.firstChild;

    while (
      child &&
      ['(', ')', ','].includes(child.type.name)
    ) {
      child = child.nextSibling;
    }

    if (!child) {
      break;
    }

    currentNode = child;
  }

  return currentNode;
}

const COMMON_SUPPORTED_NODE_TYPES = [
  'VariableName',
  'Identifier',
  'NumericLiteral',
  'StringLiteral',
  'BooleanLiteral',
  'ArithmeticExpression',
  'ArithOp',
  'CompareOp',
  'ParenthesizedExpression',
  'FunctionInvocation',
  'PositionalParameters',
  '(',
  ')',
  '[',
  ']',
  '..',
  ','
];

const SUPPORTED_NODE_TYPES: Record<
  SupportedSFeelKind,
  Set<string>
> = {
  expression: new Set([
    ...COMMON_SUPPORTED_NODE_TYPES,
    'Expression',
    'Comparison',
    'Conjunction',
    'Disjunction',
    'and',
    'or'
  ]),

  unaryTests: new Set([
    ...COMMON_SUPPORTED_NODE_TYPES,
    'UnaryTests',
    'Wildcard',
    'PositiveUnaryTests',
    'PositiveUnaryTest',
    'SimplePositiveUnaryTest',
    'Interval',
    'not'
  ])
};

function collectUnsupportedSyntaxDiagnostics(
  node: FeelSyntaxNode,
  expression: string,
  supportedNodeTypes: Set<string>,
  diagnostics: SupportedSFeelDiagnostic[]
): void {
  /*
   * Parser error nodes are handled separately as syntax errors.
   */
  if (node.type.isError) {
    return;
  }

  if (!supportedNodeTypes.has(node.type.name)) {
    diagnostics.push({
      code: 'unsupported-expression',
      message:
        `The expression "${expression.slice(node.from, node.to)}" ` +
        `uses the unsupported FEEL construct ` +
        `"${node.type.name}".`,
      from: node.from,
      to: node.to
    });

    /*
     * Do not report every child of an already unsupported construct.
     */
    return;
  }

  let child = node.firstChild;

  while (child) {
    collectUnsupportedSyntaxDiagnostics(
      child,
      expression,
      supportedNodeTypes,
      diagnostics
    );

    child = child.nextSibling;
  }
}

function applyNotConstraints(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>
): void {
  if (node.type.name === 'FunctionInvocation') {
    const functionNameNode = node.firstChild;
    const functionName = functionNameNode
      ? expression.slice(functionNameNode.from, functionNameNode.to)
      : '';

    if (functionName === 'not') {
      const parameters = findChild(node, 'PositionalParameters');

      if (parameters) {
        const argument = unwrapNode(parameters);

        if (argument.type.name === 'VariableName') {
          const variableName = expression.slice(
            argument.from,
            argument.to
          );

          const variable = variables.get(variableName);

          if (variable) {
            variable.possibleTypes = ['boolean'];
          }
        }
      }
    }
  }

  let child = node.firstChild;

  while (child) {
    applyNotConstraints(child, expression, variables);
    child = child.nextSibling;
  }
}

function collectVariableNames(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>
): string[] {
  if (node.type.name === 'VariableName') {
    const variableName = expression.slice(node.from, node.to);

    return variables.has(variableName)
      ? [variableName]
      : [];
  }

  const variableNames: string[] = [];
  let child = node.firstChild;

  while (child) {
    variableNames.push(
      ...collectVariableNames(child, expression, variables)
    );

    child = child.nextSibling;
  }

  return Array.from(new Set(variableNames));
}

interface SourceRange {
  from: number;
  to: number;
}

function collectVariablePositions(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>,
  positions: Map<string, SourceRange> = new Map()
): Map<string, SourceRange> {
  if (node.type.name === 'VariableName') {
    const variableName = expression.slice(node.from, node.to);

    if (
      variables.has(variableName) &&
      !positions.has(variableName)
    ) {
      positions.set(variableName, {
        from: node.from,
        to: node.to
      });
    }

    return positions;
  }

  let child = node.firstChild;

  while (child) {
    collectVariablePositions(
      child,
      expression,
      variables,
      positions
    );

    child = child.nextSibling;
  }

  return positions;
}

function restrictVariableTypes(
  variableNames: string[],
  allowedTypes: SupportedVariableType[],
  variables: Map<string, SupportedSFeelVariable>
): void {
  variableNames.forEach(variableName => {
    const variable = variables.get(variableName);

    if (!variable) {
      return;
    }

    variable.possibleTypes = variable.possibleTypes.filter(type =>
      allowedTypes.includes(type)
    );
  });
}

function applyBooleanOperandConstraint(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>
): void {
  const operand = unwrapNode(node);

  /*
   * These expressions already produce Boolean results. Their internal
   * variables receive their own constraints during tree traversal.
   */
  if (
    [
      'BooleanLiteral',
      'Comparison',
      'Conjunction',
      'Disjunction',
      'FunctionInvocation'
    ].includes(operand.type.name)
  ) {
    return;
  }

  const variableNames = collectVariableNames(
    operand,
    expression,
    variables
  );

  restrictVariableTypes(
    variableNames,
    ['boolean'],
    variables
  );
}

function applyRelatedVariableConstraints(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>,
  selectedTypes: Record<string, SupportedVariableType>
): void {
  /*
   * Visit children first so constraints from nested expressions are
   * available to their parent expression.
   */
  let child = node.firstChild;

  while (child) {
    applyRelatedVariableConstraints(
      child,
      expression,
      variables,
      selectedTypes
    );

    child = child.nextSibling;
  }

  const variableNames = collectVariableNames(
    node,
    expression,
    variables
  );

  if (
    node.type.name === 'ArithmeticExpression'
  ) {
    restrictVariableTypes(
      variableNames,
      ['number'],
      variables
    );

    return;
  }

  if (
    node.type.name === 'Conjunction' ||
    node.type.name === 'Disjunction'
  ) {
    let operand = node.firstChild;

    while (operand) {
      if (
        operand.type.name !== 'and' &&
        operand.type.name !== 'or'
      ) {
        applyBooleanOperandConstraint(
          operand,
          expression,
          variables
        );
      }

      operand = operand.nextSibling;
    }

    return;
  }

  if (node.type.name !== 'Comparison') {
    return;
  }

  const operatorNode = findChild(node, 'CompareOp');

  if (!operatorNode) {
    return;
  }

  const operator = expression.slice(
    operatorNode.from,
    operatorNode.to
  );

  if (['<', '<=', '>', '>='].includes(operator)) {
    restrictVariableTypes(
      variableNames,
      ['number'],
      variables
    );

    return;
  }

  if (!['=', '!='].includes(operator)) {
    return;
  }

  const requiredTypes = new Set<SupportedVariableType>();

  variableNames.forEach(variableName => {
    const selectedType = selectedTypes[variableName];

    if (selectedType) {
      requiredTypes.add(selectedType);
    }

    const variable = variables.get(variableName);

    if (variable?.possibleTypes.length === 1) {
      requiredTypes.add(variable.possibleTypes[0]);
    }
  });

  if (requiredTypes.size === 1) {
    restrictVariableTypes(
      variableNames,
      Array.from(requiredTypes),
      variables
    );

    return;
  }

  if (requiredTypes.size > 1) {
    variableNames.forEach(variableName => {
      const variable = variables.get(variableName);

      if (variable) {
        variable.possibleTypes = [];
      }
    });
  }
}

function inferExpressionResultTypes(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>,
  selectedTypes: Record<string, SupportedVariableType>
): SupportedVariableType[] {
  switch (node.type.name) {
    case 'Expression': {
      const expressionNode = node.firstChild;

      return expressionNode
        ? inferExpressionResultTypes(
          expressionNode,
          expression,
          variables,
          selectedTypes
        )
        : [];
    }

    case 'ParenthesizedExpression': {
      const innerNode = unwrapNode(node);

      if (innerNode === node) {
        return [];
      }

      return inferExpressionResultTypes(
        innerNode,
        expression,
        variables,
        selectedTypes
      );
    }

    case 'NumericLiteral':
    case 'ArithmeticExpression':
      return ['number'];

    case 'StringLiteral':
      return ['string'];

    case 'BooleanLiteral':
    case 'Comparison':
    case 'Conjunction':
    case 'Disjunction':
      return ['boolean'];

    case 'VariableName': {
      const variableName = expression.slice(
        node.from,
        node.to
      );

      const selectedType = selectedTypes[variableName];

      if (selectedType) {
        return [selectedType];
      }

      return variables.get(variableName)?.possibleTypes ?? [];
    }

    case 'FunctionInvocation': {
      const functionNameNode = node.firstChild;
      const functionName = functionNameNode
        ? expression.slice(
          functionNameNode.from,
          functionNameNode.to
        )
        : '';

      return functionName === 'not'
        ? ['boolean']
        : [];
    }

    default:
      return [];
  }
}

function inferPossibleResultTypes(
  tree: FeelSyntaxNode,
  expression: string,
  kind: SupportedSFeelKind,
  variables: Map<string, SupportedSFeelVariable>,
  selectedTypes: Record<string, SupportedVariableType>
): SupportedVariableType[] {
  /*
   * A unary test evaluates whether its implicit input matches,
   * so its result is always Boolean.
   */
  if (kind === 'unaryTests') {
    return ['boolean'];
  }

  return inferExpressionResultTypes(
    tree,
    expression,
    variables,
    selectedTypes
  );
}

function inferUnaryTestValueTypes(
  node: FeelSyntaxNode,
  expression: string,
  variables: Map<string, SupportedSFeelVariable>,
  selectedTypes: Record<string, SupportedVariableType>
): SupportedVariableType[] {
  switch (node.type.name) {
    case 'NumericLiteral':
    case 'ArithmeticExpression':
      return ['number'];

    case 'StringLiteral':
      return ['string'];

    case 'BooleanLiteral':
      return ['boolean'];

    case 'VariableName': {
      const variableName = expression.slice(
        node.from,
        node.to
      );

      const selectedType = selectedTypes[variableName];

      if (selectedType) {
        return [selectedType];
      }

      return variables.get(variableName)?.possibleTypes ?? [];
    }
  }

  const possibleTypes =
    new Set<SupportedVariableType>();

  let child = node.firstChild;

  while (child) {
    inferUnaryTestValueTypes(
      child,
      expression,
      variables,
      selectedTypes
    ).forEach(type => possibleTypes.add(type));

    child = child.nextSibling;
  }

  return Array.from(possibleTypes);
}

function collectUnaryTestTypeDiagnostics(
  node: FeelSyntaxNode,
  expression: string,
  expectedType: SupportedVariableType,
  variables: Map<string, SupportedSFeelVariable>,
  selectedTypes: Record<string, SupportedVariableType>,
  diagnostics: SupportedSFeelDiagnostic[]
): void {
  if (node.type.name === 'PositiveUnaryTest') {
    const actualTypes = inferUnaryTestValueTypes(
      node,
      expression,
      variables,
      selectedTypes
    );

    if (actualTypes.some(type => type !== expectedType)) {
      diagnostics.push({
        code: 'unary-test-type-mismatch',
        message:
          `The unary test must compare ${expectedType} values, ` +
          `but this value is ${actualTypes.join(' or ')}.`,
        from: node.from,
        to: node.to
      });
    }

    return;
  }

  let child = node.firstChild;

  while (child) {
    collectUnaryTestTypeDiagnostics(
      child,
      expression,
      expectedType,
      variables,
      selectedTypes,
      diagnostics
    );

    child = child.nextSibling;
  }
}

export function validateSupportedSFeel(
  expression: string,
  options: SupportedSFeelOptions = {}
): SupportedSFeelResult {
  const kind = options.kind ?? 'expression';
  const analyzer = analyzers[kind];
  const tree = analyzer.parser.parse(expression);
  const analysis = analyzer.analyzeTree(tree, expression);
  const diagnostics: SupportedSFeelDiagnostic[] = [];

  const syntaxDiagnostics = lintExpression(expression, {
    dialect: kind,
    parserDialect: 'camunda',
    builtins: camundaBuiltins
  }).filter(diagnostic => diagnostic.severity === 'error');

  syntaxDiagnostics.forEach(diagnostic => {
    diagnostics.push({
      code: 'syntax-error',
      message: diagnostic.message,
      from: diagnostic.from,
      to: diagnostic.to
    });
  });

  /*
   * This fallback ensures every invalid parse still receives a
   * diagnostic, even if the linter unexpectedly returns none.
   */
  if (!analysis.valid && syntaxDiagnostics.length === 0) {
    diagnostics.push({
      code: 'syntax-error',
      message: 'The expression contains invalid FEEL syntax.',
      from: expression.length,
      to: expression.length
    });
  }

  collectUnsupportedSyntaxDiagnostics(
    tree.topNode,
    expression,
    SUPPORTED_NODE_TYPES[kind],
    diagnostics
  );

  analysis.functions
    ?.filter(invokedFunction => invokedFunction.name !== 'not')
    .forEach(invokedFunction => {
      diagnostics.push({
        code: 'unsupported-function',
        message:
          `The function "${invokedFunction.name}" is not supported.`,
        from: invokedFunction.from,
        to: invokedFunction.to
      });
    });

  const variables = new Map<string, SupportedSFeelVariable>();

  analysis.inputs?.forEach(inputVariable => {
    const inferredType = convertAnalyzerType(inputVariable.type);

    variables.set(inputVariable.name, {
      name: inputVariable.name,
      possibleTypes: inferredType
        ? [inferredType]
        : [...ALL_SUPPORTED_TYPES]
    });
  });

  applyNotConstraints(tree.topNode, expression, variables);

  applyRelatedVariableConstraints(
    tree.topNode,
    expression,
    variables,
    options.variableTypes ?? {}
  );

  if (
    kind === 'unaryTests' &&
    options.expectedUnaryTestInputType
  ) {
    const expectedInputType =
      options.expectedUnaryTestInputType;

    restrictVariableTypes(
      collectVariableNames(
        tree.topNode,
        expression,
        variables
      ),
      [expectedInputType],
      variables
    );

    if (analysis.valid) {
      collectUnaryTestTypeDiagnostics(
        tree.topNode,
        expression,
        expectedInputType,
        variables,
        options.variableTypes ?? {},
        diagnostics
      );
    }
  }

  const possibleResultTypes = inferPossibleResultTypes(
    tree.topNode,
    expression,
    kind,
    variables,
    options.variableTypes ?? {}
  );

  if (
    analysis.valid &&
    options.expectedResultType &&
    possibleResultTypes.length > 0 &&
    !possibleResultTypes.includes(options.expectedResultType)
  ) {
    diagnostics.push({
      code: 'result-type-mismatch',
      message:
        `The expression must return ${options.expectedResultType}, ` +
        `but it returns ${possibleResultTypes.join(' or ')}.`,
      from: 0,
      to: expression.length
    });
  }

  const variablePositions = collectVariablePositions(
    tree.topNode,
    expression,
    variables
  );

  variables.forEach(variable => {
    const position = variablePositions.get(variable.name) ?? {
      from: 0,
      to: expression.length
    };

    if (variable.possibleTypes.length === 0) {
      diagnostics.push({
        code: 'type-mismatch',
        variable: variable.name,
        message:
          `"${variable.name}" has incompatible type requirements.`,
        ...position
      });

      return;
    }
    const selectedType =
      options.variableTypes?.[variable.name];

    if (
      selectedType &&
      !variable.possibleTypes.includes(selectedType)
    ) {
      diagnostics.push({
        code: 'type-mismatch',
        variable: variable.name,
        message:
          `"${variable.name}" must have one of these types: ` +
          variable.possibleTypes.join(', ') +
          `. Its selected type is ${selectedType}.`,
        ...position
      });

      return;
    }

    if (
      !selectedType &&
      variable.possibleTypes.length > 1
    ) {
      diagnostics.push({
        code: 'type-required',
        variable: variable.name,
        message:
          `Select a type for "${variable.name}". Possible types: ` +
          variable.possibleTypes.join(', ') +
          '.',
        ...position
      });
    }
  });

  return {
    valid: analysis.valid && diagnostics.length === 0,
    variables: Array.from(variables.values()),
    possibleResultTypes,
    diagnostics
  };
}
