import {
  collectModelFeelErrors,
  formatModelFeelError
} from '../../modelFeelErrors';

import type {
  ModelFeelAnalysisResult,
  ModelFeelSource
} from '../../modelFeelAnalysis';

describe('model FEEL errors', () => {
  test('combines FEEL, conflict and initial-value errors', () => {
    const source: ModelFeelSource = {
      origin: 'bpmn-gateway-condition',
      elementId: 'TextAnnotation_1',
      gatewayId: 'Gateway_1',
      associationId: 'Association_1',
      flowId: 'Flow_1',
      targetId: 'Task_1',
      expression: 'date()',
      feelKind: 'expression',
      expectedType: 'boolean'
    };

    const result: ModelFeelAnalysisResult = {
      valid: false,
      analyses: [],
      variables: [
        {
          name: 'age',
          possibleTypes: ['number'],
          resolvedType: 'number',
          typeOrigin: 'inferred',
          status: 'resolved'
        },
        {
          name: 'category',
          possibleTypes: [],
          status: 'conflict'
        },
        {
          name: 'status',
          possibleTypes: ['string', 'number'],
          status: 'unresolved'
        }
      ],
      diagnostics: [
        {
          source,
          diagnostic: {
            code: 'unsupported-function',
            message: 'Function "date" is not supported.',
            from: 0,
            to: 6
          }
        }
      ],
      conflicts: [
        {
          variable: {
            name: 'category',
            possibleTypes: [],
            status: 'conflict'
          },
          message:
            '"category" has incompatible type requirements ' +
            'across the model.',
          sources: [source]
        }
      ]
    };

    const errors = collectModelFeelErrors(
      result,
      {
        age: 'not-a-number',
        status: 'premium'
      }
    );

    expect(errors).toHaveLength(4);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'feel',
          message:
            'Function "date" is not supported.',
          source
        }),

        expect.objectContaining({
          kind: 'conflict',
          variableName: 'category',
          message:
            '"category" has incompatible type requirements ' +
            'across the model.'
        }),

        expect.objectContaining({
          kind: 'initial-value',
          variableName: 'age',
          code: 'initial-value-invalid-number'
        }),

        expect.objectContaining({
          kind: 'initial-value',
          variableName: 'status',
          code: 'initial-value-type-unresolved'
        })
      ])
    );
  });

  test('returns no errors for a valid configured model', () => {
    const result: ModelFeelAnalysisResult = {
      valid: true,
      analyses: [],
      variables: [
        {
          name: 'age',
          possibleTypes: ['number'],
          resolvedType: 'number',
          typeOrigin: 'inferred',
          status: 'resolved'
        }
      ],
      diagnostics: [],
      conflicts: []
    };

    expect(
      collectModelFeelErrors(result, {
        age: '18'
      })
    ).toEqual([]);
  });
});

describe('model FEEL error formatting', () => {
  test('adds BPMN gateway and flow context', () => {
    expect(
      formatModelFeelError({
        kind: 'feel',
        code: 'unsupported-function',
        message:
          'Function "date" is not supported.',
        source: {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'date()',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        from: 0,
        to: 6
      })
    ).toBe(
      'BPMN gateway "Gateway_1", flow "Flow_1": ' +
      'Function "date" is not supported.'
    );
  });

  test('adds DMN decision, table and cell context', () => {
    expect(
      formatModelFeelError({
        kind: 'feel',
        code: 'result-type-mismatch',
        message:
          'Expected a Boolean result.',
        source: {
          origin: 'dmn-output-cell',
          elementId: 'OutputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 1,
          column: 2,
          expression: '"approved"',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        from: 0,
        to: 10
      })
    ).toBe(
      'DMN decision "Decision_1", ' +
      'table "DecisionTable_1", ' +
      'output cell row 2, column 3: ' +
      'Expected a Boolean result.'
    );
  });

  test('identifies initial-value errors', () => {
    expect(
      formatModelFeelError({
        kind: 'initial-value',
        code: 'initial-value-invalid-number',
        variableName: 'age',
        value: 'invalid',
        message:
          '"age" must have a valid numeric initial value.'
      })
    ).toBe(
      'Initial value: ' +
      '"age" must have a valid numeric initial value.'
    );
  });
});
