import {
  validateSupportedSFeel,
  type SupportedSFeelDiagnostic,
  type SupportedSFeelKind,
  type SupportedSFeelResult,
  type SupportedSFeelVariable,
  type SupportedVariableType
} from './supportedSFeel';

export type DmnFeelOrigin =
  | 'dmn-input-header'
  | 'dmn-output-header'
  | 'dmn-input-cell'
  | 'dmn-output-cell';

export interface DmnFeelSource {
  origin: DmnFeelOrigin;
  elementId: string;
  markerElementId?: string;
  decisionId: string;
  tableId: string;
  row?: number;
  column: number;
  expression: string;
  feelKind: SupportedSFeelKind;
  expectedType?: SupportedVariableType;
}

export interface BpmnGatewayFeelSource {
  origin: 'bpmn-gateway-condition';
  elementId: string;
  gatewayId: string;
  associationId: string;
  flowId: string;
  targetId: string;
  expression: string;
  feelKind: 'expression';
  expectedType: 'boolean';
}

export type ModelFeelSource =
  | DmnFeelSource
  | BpmnGatewayFeelSource;

export interface AnalyzedModelFeelSource {
  source: ModelFeelSource;
  result: SupportedSFeelResult;
}

export interface ModelFeelDiagnostic {
  source: ModelFeelSource;
  diagnostic: SupportedSFeelDiagnostic;
}

export interface ModelFeelVariableConflict {
  variable: ResolvedModelFeelVariable;
  message: string;
  sources: ModelFeelSource[];
}

export interface ModelFeelAnalysisResult {
  valid: boolean;
  analyses: AnalyzedModelFeelSource[];
  variables: ResolvedModelFeelVariable[];
  diagnostics: ModelFeelDiagnostic[];
  conflicts: ModelFeelVariableConflict[];
}

export type ModelFeelVariableTypeOrigin =
  | 'declared'
  | 'user'
  | 'inferred';

export type ModelFeelVariableStatus =
  | 'resolved'
  | 'unresolved'
  | 'conflict';

export interface ResolvedModelFeelVariable
  extends SupportedSFeelVariable {
  resolvedType?: SupportedVariableType;
  typeOrigin?: ModelFeelVariableTypeOrigin;
  status: ModelFeelVariableStatus;
}

interface DmnExpressionElement {
  id?: string;
  text?: string;
  typeRef?: unknown;
}

interface DmnInputClause {
  id?: string;
  inputExpression?: DmnExpressionElement;
}

interface DmnOutputClause {
  id?: string;
  name?: string;
  typeRef?: unknown;
}

interface DmnRule {
  id?: string;
  inputEntry?: DmnExpressionElement[];
  outputEntry?: DmnExpressionElement[];
}

interface DmnDecisionTable {
  id?: string;
  input?: DmnInputClause[];
  output?: DmnOutputClause[];
  rule?: DmnRule[];
}

interface DmnDecision {
  id?: string;
  decisionLogic?: DmnDecisionTable;
}

interface DmnView {
  id?: string;
  type?: string;
  element?: DmnDecision;
}

export interface DmnModelerLike {
  getViews?: () => DmnView[];
}

interface BpmnElementReference {
  id?: string;
  $type?: string;
}

interface BpmnSequenceFlow extends BpmnElementReference {
  sourceRef?: BpmnElementReference;
  targetRef?: BpmnElementReference;
}

interface BpmnTextAnnotation extends BpmnElementReference {
  text?: string;
}

interface BpmnArtifact extends BpmnElementReference {
  sourceRef?: BpmnSequenceFlow;
  targetRef?: BpmnTextAnnotation;
}

interface BpmnDiagramConnection {
  businessObject?: BpmnArtifact;
}

interface BpmnDiagramElement {
  businessObject?: BpmnElementReference;
  incoming?: BpmnDiagramConnection[];
}

interface BpmnRootElement {
  artifacts?: BpmnArtifact[];
}

interface BpmnDefinitions {
  rootElements?: BpmnRootElement[];
}

export interface BpmnModelerLike {
  getDefinitions?: () => BpmnDefinitions;
  _definitions?: BpmnDefinitions;
}

export interface AnalyzeModelFeelOptions {
  dmnModeler?: DmnModelerLike;
  bpmnModeler?: BpmnModelerLike;
  variableTypes?: Record<string, SupportedVariableType>;
}

function normalizeExpectedType(
  typeRef: unknown
): SupportedVariableType | undefined {
  if (typeof typeRef !== 'string') {
    return undefined;
  }

  const normalizedType = typeRef
    .toLowerCase()
    .split(':')
    .at(-1);

  switch (normalizedType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return undefined;
  }
}

function getText(value: unknown): string {
  return typeof value === 'string'
    ? value
    : '';
}

export function isBpmnGatewayConditionAnnotation(
  element: BpmnDiagramElement | null | undefined
): boolean {
  if (
    element?.businessObject?.$type !==
    'bpmn:TextAnnotation'
  ) {
    return false;
  }

  return element.incoming?.some(connection => {
    const association =
      connection.businessObject;

    return (
      association?.$type ===
        'bpmn:Association' &&
      association.sourceRef?.$type ===
        'bpmn:SequenceFlow' &&
      association.sourceRef.sourceRef?.$type ===
        'bpmn:ExclusiveGateway'
    );
  }) ?? false;
}

export function collectDmnFeelSources(
  dmnModeler: DmnModelerLike | null | undefined
): DmnFeelSource[] {
  const views = dmnModeler?.getViews?.() ?? [];
  const sources: DmnFeelSource[] = [];

  views.forEach(view => {
    if (view.type !== 'decisionTable') {
      return;
    }

    const decision = view.element;
    const table = decision?.decisionLogic;

    if (!decision || !table) {
      return;
    }

    const decisionId =
      decision.id ??
      view.id ??
      'unknown-decision';

    const tableId =
      table.id ??
      `${decisionId}:decision-table`;

    const inputs = table.input ?? [];
    const outputs = table.output ?? [];

    inputs.forEach((input, column) => {
      const inputExpression = input.inputExpression;
      const expression = getText(inputExpression?.text);
      const expectedType = normalizeExpectedType(
        inputExpression?.typeRef
      );

      sources.push({
        origin: 'dmn-input-header',
        elementId:
          inputExpression?.id ??
          input.id ??
          `${tableId}:input:${column}:header`,
        markerElementId:
          input.id ??
          inputExpression?.id ??
          `${tableId}:input:${column}:header`,
        decisionId,
        tableId,
        column,
        expression,
        feelKind: 'expression',
        expectedType
      });
    });

    outputs.forEach((output, column) => {
      const expression = getText(output.name);
      const expectedType = normalizeExpectedType(
        output.typeRef
      );

      sources.push({
        origin: 'dmn-output-header',
        elementId:
          output.id ??
          `${tableId}:output:${column}:header`,
        markerElementId:
          output.id ??
          `${tableId}:output:${column}:header`,
        decisionId,
        tableId,
        column,
        expression,
        feelKind: 'expression',
        expectedType
      });
    });

    const rules = table.rule ?? [];

    rules.forEach((rule, row) => {
      const inputEntries = rule.inputEntry ?? [];
      const outputEntries = rule.outputEntry ?? [];

      inputEntries.forEach((entry, column) => {
        const text = getText(entry.text);
        const expression =
          text.trim() === ''
            ? '-'
            : text;

        const expectedType = normalizeExpectedType(
          inputs[column]?.inputExpression?.typeRef
        );

        sources.push({
          origin: 'dmn-input-cell',
          elementId:
            entry.id ??
            `${tableId}:input:${row}:${column}`,
          markerElementId:
            entry.id ??
            `${tableId}:input:${row}:${column}`,
          decisionId,
          tableId,
          row,
          column,
          expression,
          feelKind: 'unaryTests',
          expectedType
        });
      });

      outputEntries.forEach((entry, column) => {
        const expression = getText(entry.text);
        const expectedType = normalizeExpectedType(
          outputs[column]?.typeRef
        );

        sources.push({
          origin: 'dmn-output-cell',
          elementId:
            entry.id ??
            `${tableId}:output:${row}:${column}`,
          markerElementId:
            entry.id ??
            `${tableId}:output:${row}:${column}`,
          decisionId,
          tableId,
          row,
          column,
          expression,
          feelKind: 'expression',
          expectedType
        });
      });
    });
  });

  return sources;
}

export function collectBpmnGatewayFeelSources(
  bpmnModeler: BpmnModelerLike | null | undefined
): BpmnGatewayFeelSource[] {
  const definitions =
    bpmnModeler?.getDefinitions?.() ??
    bpmnModeler?._definitions;

  const sources: BpmnGatewayFeelSource[] = [];

  definitions?.rootElements?.forEach(rootElement => {
    rootElement.artifacts?.forEach(artifact => {
      if (artifact.$type !== 'bpmn:Association') {
        return;
      }

      const flow = artifact.sourceRef;
      const gateway = flow?.sourceRef;
      const target = flow?.targetRef;
      const annotation = artifact.targetRef;

      if (
        gateway?.$type !== 'bpmn:ExclusiveGateway' ||
        !annotation
      ) {
        return;
      }

      const gatewayId =
        gateway.id ??
        'unknown-gateway';

      const flowId =
        flow?.id ??
        `${gatewayId}:flow`;

      const associationId =
        artifact.id ??
        `${flowId}:condition-association`;

      sources.push({
        origin: 'bpmn-gateway-condition',
        elementId:
          annotation.id ??
          `${associationId}:annotation`,
        gatewayId,
        associationId,
        flowId,
        targetId:
          target?.id ??
          `${flowId}:target`,
        expression: getText(annotation.text),
        feelKind: 'expression',
        expectedType: 'boolean'
      });
    });
  });

  return sources;
}

export function collectDeclaredVariableTypes(
  sources: ModelFeelSource[]
): Record<string, SupportedVariableType> {
  const variableTypes: Record<
    string,
    SupportedVariableType
  > = {};

  sources.forEach(source => {
    const isHeader =
      source.origin === 'dmn-input-header' ||
      source.origin === 'dmn-output-header';

    if (!isHeader || !source.expectedType) {
      return;
    }

    const variableName = source.expression.trim();

    if (variableName === '') {
      return;
    }

    variableTypes[variableName] = source.expectedType;
  });

  return variableTypes;
}

export function analyzeModelFeelSources(
  sources: ModelFeelSource[],
  variableTypes: Record<string, SupportedVariableType> = {}
): AnalyzedModelFeelSource[] {
  const declaredVariableTypes =
    collectDeclaredVariableTypes(sources);

  /*
   * DMN typeRef declarations are authoritative. User selections
   * provide types only where the model does not declare one.
   */
  const effectiveVariableTypes = {
    ...variableTypes,
    ...declaredVariableTypes
  };

  return sources.map(source => ({
    source,
    result: validateSupportedSFeel(
      source.expression,
      {
        kind: source.feelKind,
        variableTypes: effectiveVariableTypes,

        expectedResultType:
          source.feelKind === 'expression'
            ? source.expectedType
            : undefined,

        expectedUnaryTestInputType:
          source.feelKind === 'unaryTests'
            ? source.expectedType
            : undefined
      }
    )
  }));
}

export function collectModelFeelVariables(
  analyses: AnalyzedModelFeelSource[]
): SupportedSFeelVariable[] {
  const possibleTypesByVariable =
    new Map<string, SupportedVariableType[]>();

  analyses.forEach(({ result }) => {
    result.variables.forEach(variable => {
      const existingTypes =
        possibleTypesByVariable.get(variable.name);

      if (!existingTypes) {
        possibleTypesByVariable.set(
          variable.name,
          [...variable.possibleTypes]
        );

        return;
      }

      possibleTypesByVariable.set(
        variable.name,
        existingTypes.filter(type =>
          variable.possibleTypes.includes(type)
        )
      );
    });
  });

  return Array.from(
    possibleTypesByVariable,
    ([name, possibleTypes]) => ({
      name,
      possibleTypes
    })
  ).sort((first, second) =>
    first.name.localeCompare(second.name)
  );
}

export function resolveModelFeelVariables(
  analyses: AnalyzedModelFeelSource[],
  userTypes: Record<string, SupportedVariableType> = {}
): ResolvedModelFeelVariable[] {
  const variables =
    collectModelFeelVariables(analyses);

  const declaredTypes =
    collectDeclaredVariableTypes(
      analyses.map(analysis => analysis.source)
    );

  return variables.map(variable => {
    const declaredType =
      declaredTypes[variable.name];

    const userType =
      userTypes[variable.name];

    const inferredType =
      variable.possibleTypes.length === 1
        ? variable.possibleTypes[0]
        : undefined;

    const resolvedType =
      declaredType ??
      userType ??
      inferredType;

    let typeOrigin:
      ModelFeelVariableTypeOrigin | undefined;

    if (declaredType) {
      typeOrigin = 'declared';
    } else if (userType) {
      typeOrigin = 'user';
    } else if (inferredType) {
      typeOrigin = 'inferred';
    }

    const hasConflict =
      variable.possibleTypes.length === 0 ||
      (
        resolvedType !== undefined &&
        !variable.possibleTypes.includes(resolvedType)
      );

    const status: ModelFeelVariableStatus =
      hasConflict
        ? 'conflict'
        : resolvedType
          ? 'resolved'
          : 'unresolved';

    if (!resolvedType || !typeOrigin) {
      return {
        ...variable,
        status
      };
    }

    return {
      ...variable,
      resolvedType,
      typeOrigin,
      status
    };
  });
}

export function collectModelFeelDiagnostics(
  analyses: AnalyzedModelFeelSource[]
): ModelFeelDiagnostic[] {
  const diagnostics: ModelFeelDiagnostic[] = [];

  analyses.forEach(({ source, result }) => {
    result.diagnostics.forEach(diagnostic => {
      diagnostics.push({
        source,
        diagnostic
      });
    });
  });

  return diagnostics;
}

export function collectModelFeelVariableConflicts(
  analyses: AnalyzedModelFeelSource[],
  userTypes: Record<string, SupportedVariableType> = {}
): ModelFeelVariableConflict[] {
  const conflictingVariables =
    resolveModelFeelVariables(
      analyses,
      userTypes
    ).filter(variable =>
      variable.status === 'conflict'
    );

  return conflictingVariables.map(variable => {
    const sources = analyses
      .filter(({ result }) =>
        result.variables.some(
          sourceVariable =>
            sourceVariable.name === variable.name
        )
      )
      .map(analysis => analysis.source);

    return {
      variable,
      message:
        `"${variable.name}" has incompatible type requirements ` +
        'across the model.',
      sources
    };
  });
}

export function analyzeModelFeel({
  dmnModeler,
  bpmnModeler,
  variableTypes = {}
}: AnalyzeModelFeelOptions): ModelFeelAnalysisResult {
  const sources: ModelFeelSource[] = [
    ...(
      dmnModeler
        ? collectDmnFeelSources(dmnModeler)
        : []
    ),
    ...(
      bpmnModeler
        ? collectBpmnGatewayFeelSources(bpmnModeler)
        : []
    )
  ];

  const analyses = analyzeModelFeelSources(
    sources,
    variableTypes
  );

  const variables = resolveModelFeelVariables(
    analyses,
    variableTypes
  );

  const diagnostics =
    collectModelFeelDiagnostics(analyses);

  const conflicts =
    collectModelFeelVariableConflicts(
      analyses,
      variableTypes
    );

  return {
    valid:
      analyses.every(
        analysis => analysis.result.valid
      ) &&
      conflicts.length === 0,
    analyses,
    variables,
    diagnostics,
    conflicts
  };
}
