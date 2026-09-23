import {
  analyzeModelFeel,
  analyzeModelFeelSources,
  collectBpmnGatewayFeelSources,
  collectDeclaredVariableTypes,
  collectDmnFeelSources,
  collectModelFeelDiagnostics,
  collectModelFeelVariableConflicts,
  collectModelFeelVariables,
  isBpmnGatewayConditionAnnotation,
  resolveModelFeelVariables,
  type ModelFeelSource
} from '../../modelFeelAnalysis';

describe('modelFeelAnalysis – DMN', () => {
  describe('Expression sources', () => {
    test('collects headers and cells with their origins', () => {
      const dmnModeler = {
        getViews: () => [
          {
            type: 'decisionTable',
            element: {
              id: 'Decision_1',
              decisionLogic: {
                id: 'DecisionTable_1',

                input: [
                  {
                    id: 'InputClause_age',
                    inputExpression: {
                      id: 'InputExpression_age',
                      text: 'age',
                      typeRef: 'number'
                    }
                  }
                ],

                output: [
                  {
                    id: 'OutputClause_approved',
                    name: 'approved',
                    typeRef: 'boolean'
                  }
                ],

                rule: [
                  {
                    id: 'Rule_1',
                    inputEntry: [
                      {
                        id: 'InputEntry_1',
                        text: '>= 18'
                      }
                    ],
                    outputEntry: [
                      {
                        id: 'OutputEntry_1',
                        text: 'true'
                      }
                    ]
                  },
                  {
                    id: 'Rule_2',
                    inputEntry: [
                      {
                        id: 'InputEntry_2',
                        text: ''
                      }
                    ],
                    outputEntry: [
                      {
                        id: 'OutputEntry_2',
                        text: 'false'
                      }
                    ]
                  }
                ]
              }
            }
          }
        ]
      };

      const sources = collectDmnFeelSources(dmnModeler);

      expect(sources).toEqual([
        {
          origin: 'dmn-input-header',
          elementId: 'InputExpression_age',
          markerElementId: 'InputClause_age',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 0,
          expression: 'age',
          feelKind: 'expression',
          expectedType: 'number'
        },
        {
          origin: 'dmn-output-header',
          elementId: 'OutputClause_approved',
          markerElementId: 'OutputClause_approved',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 0,
          expression: 'approved',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_1',
          markerElementId: 'InputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '>= 18',
          feelKind: 'unaryTests',
          expectedType: 'number'
        },
        {
          origin: 'dmn-output-cell',
          elementId: 'OutputEntry_1',
          markerElementId: 'OutputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: 'true',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_2',
          markerElementId: 'InputEntry_2',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 1,
          column: 0,
          expression: '-',
          feelKind: 'unaryTests',
          expectedType: 'number'
        },
        {
          origin: 'dmn-output-cell',
          elementId: 'OutputEntry_2',
          markerElementId: 'OutputEntry_2',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 1,
          column: 0,
          expression: 'false',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ]);
    });

    test('ignores views that are not decision tables', () => {
      const dmnModeler = {
        getViews: () => [
          {
            type: 'drd',
            element: {
              id: 'Definitions_1'
            }
          }
        ]
      };

      expect(collectDmnFeelSources(dmnModeler)).toEqual([]);
    });
  });
});

describe('modelFeelAnalysis – BPMN', () => {
  describe('Gateway expression sources', () => {
    test('collects conditions attached to exclusive-gateway flows', () => {
      const bpmnModeler = {
        _definitions: {
          rootElements: [
            {
              artifacts: [
                {
                  $type: 'bpmn:Association',
                  id: 'Association_1',

                  sourceRef: {
                    $type: 'bpmn:SequenceFlow',
                    id: 'Flow_1',

                    sourceRef: {
                      $type: 'bpmn:ExclusiveGateway',
                      id: 'Gateway_1'
                    },

                    targetRef: {
                      $type: 'bpmn:Task',
                      id: 'Task_1'
                    }
                  },

                  targetRef: {
                    $type: 'bpmn:TextAnnotation',
                    id: 'TextAnnotation_1',
                    text: 'age >= 18'
                  }
                }
              ]
            }
          ]
        }
      };

      expect(
        collectBpmnGatewayFeelSources(bpmnModeler)
      ).toEqual([
        {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'age >= 18',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ]);
    });

    test('ignores associations not originating at exclusive gateways', () => {
      const bpmnModeler = {
        _definitions: {
          rootElements: [
            {
              artifacts: [
                {
                  $type: 'bpmn:Association',
                  id: 'Association_2',

                  sourceRef: {
                    $type: 'bpmn:SequenceFlow',
                    id: 'Flow_2',

                    sourceRef: {
                      $type: 'bpmn:Task',
                      id: 'Task_2'
                    },

                    targetRef: {
                      $type: 'bpmn:Task',
                      id: 'Task_3'
                    }
                  },

                  targetRef: {
                    $type: 'bpmn:TextAnnotation',
                    id: 'TextAnnotation_2',
                    text: 'ignored = true'
                  }
                }
              ]
            }
          ]
        }
      };

      expect(
        collectBpmnGatewayFeelSources(bpmnModeler)
      ).toEqual([]);
    });
    test('identifies exclusive-gateway condition annotations', () => {
      const gatewayAnnotation = {
        businessObject: {
          $type: 'bpmn:TextAnnotation'
        },

        incoming: [
          {
            businessObject: {
              $type: 'bpmn:Association',

              sourceRef: {
                $type: 'bpmn:SequenceFlow',

                sourceRef: {
                  $type: 'bpmn:ExclusiveGateway'
                }
              }
            }
          }
        ]
      };

      const ordinaryAnnotation = {
        businessObject: {
          $type: 'bpmn:TextAnnotation'
        },

        incoming: [
          {
            businessObject: {
              $type: 'bpmn:Association',

              sourceRef: {
                $type: 'bpmn:SequenceFlow',

                sourceRef: {
                  $type: 'bpmn:Task'
                }
              }
            }
          }
        ]
      };

      expect(
        isBpmnGatewayConditionAnnotation(
          gatewayAnnotation
        )
      ).toBe(true);

      expect(
        isBpmnGatewayConditionAnnotation(
          ordinaryAnnotation
        )
      ).toBe(false);
    });
  });
});

describe('modelFeelAnalysis – Validation', () => {
  describe('Source analysis', () => {
    test('uses the correct FEEL kind and preserves origins', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '>= 18',
          feelKind: 'unaryTests',
          expectedType: 'number'
        },
        {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'date("2026-08-29")',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ];

      const [inputCell, gateway] =
        analyzeModelFeelSources(sources);

      expect(inputCell.source).toBe(sources[0]);
      expect(inputCell.result.valid).toBe(true);
      expect(inputCell.result.diagnostics).toEqual([]);

      expect(gateway.source).toBe(sources[1]);
      expect(gateway.result.valid).toBe(false);
      expect(gateway.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-expression',
            from: 0,
            to: 18
          })
        ])
      );
    });

    test('applies globally selected variable types', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_2',
          gatewayId: 'Gateway_2',
          associationId: 'Association_2',
          flowId: 'Flow_2',
          targetId: 'Task_2',
          expression: 'approved and amount',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ];

      const [gateway] = analyzeModelFeelSources(
        sources,
        {
          amount: 'number'
        }
      );

      expect(gateway.result.valid).toBe(false);
      expect(gateway.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch',
            variable: 'amount',
            from: 13,
            to: 19
          })
        ])
      );
    });
  });
  describe('Declared variable types', () => {
    test('collects types declared by DMN headers', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-input-header',
          elementId: 'InputExpression_age',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 0,
          expression: 'age',
          feelKind: 'expression',
          expectedType: 'number'
        },
        {
          origin: 'dmn-output-header',
          elementId: 'OutputClause_approved',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 0,
          expression: 'approved',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        {
          origin: 'dmn-input-header',
          elementId: 'InputExpression_status',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 1,
          expression: 'status',
          feelKind: 'expression'
        }
      ];

      expect(
        collectDeclaredVariableTypes(sources)
      ).toEqual({
        age: 'number',
        approved: 'boolean'
      });
    });

    test('uses declared types when analyzing other sources', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-input-header',
          elementId: 'InputExpression_age',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          column: 0,
          expression: 'age',
          feelKind: 'expression',
          expectedType: 'number'
        },
        {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'not(age)',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ];

      const [, gateway] =
        analyzeModelFeelSources(sources);

      expect(gateway.result.valid).toBe(false);
      expect(gateway.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch',
            variable: 'age',
            from: 4,
            to: 7
          })
        ])
      );
    });
  });
  describe('Expected source types', () => {
    test('requires gateway conditions to return Boolean', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'age + 1',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ];

      const [gateway] = analyzeModelFeelSources(sources);

      expect(gateway.result.valid).toBe(false);
      expect(gateway.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'result-type-mismatch',
            from: 0,
            to: 7
          })
        ])
      );
    });

    test('checks DMN output cells against their column type', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-output-cell',
          elementId: 'OutputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '"approved"',
          feelKind: 'expression',
          expectedType: 'boolean'
        }
      ];

      const [outputCell] = analyzeModelFeelSources(sources);

      expect(outputCell.result.valid).toBe(false);
      expect(outputCell.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'result-type-mismatch',
            from: 0,
            to: 10
          })
        ])
      );
    });

    test('does not compare a unary-test result with its column type', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '>= 18',
          feelKind: 'unaryTests',
          expectedType: 'number'
        }
      ];

      const [inputCell] = analyzeModelFeelSources(sources);

      expect(inputCell.result.valid).toBe(true);
      expect(inputCell.result.diagnostics).toEqual([]);
    });

    test('checks DMN input-cell values against their column type', () => {
      const sources: ModelFeelSource[] = [
        {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '"Winter"',
          feelKind: 'unaryTests',
          expectedType: 'number'
        }
      ];

      const [inputCell] = analyzeModelFeelSources(sources);

      expect(inputCell.result.valid).toBe(false);
      expect(inputCell.result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unary-test-type-mismatch',
            from: 0,
            to: 8
          })
        ])
      );
    });
  });

});
describe('modelFeelAnalysis – Complete model', () => {
  test('analyzes DMN and BPMN sources together', () => {
    const dmnModeler = {
      getViews: () => [
        {
          type: 'decisionTable',
          element: {
            id: 'Decision_1',
            decisionLogic: {
              id: 'DecisionTable_1',

              input: [
                {
                  id: 'InputClause_age',
                  inputExpression: {
                    id: 'InputExpression_age',
                    text: 'age',
                    typeRef: 'number'
                  }
                }
              ],

              output: [],
              rule: []
            }
          }
        }
      ]
    };

    const bpmnModeler = {
      _definitions: {
        rootElements: [
          {
            artifacts: [
              {
                $type: 'bpmn:Association',
                id: 'Association_1',

                sourceRef: {
                  $type: 'bpmn:SequenceFlow',
                  id: 'Flow_1',

                  sourceRef: {
                    $type: 'bpmn:ExclusiveGateway',
                    id: 'Gateway_1'
                  },

                  targetRef: {
                    $type: 'bpmn:Task',
                    id: 'Task_1'
                  }
                },

                targetRef: {
                  $type: 'bpmn:TextAnnotation',
                  id: 'TextAnnotation_1',
                  text: 'not(age)'
                }
              }
            ]
          }
        ]
      }
    };

    const result = analyzeModelFeel({
      dmnModeler,
      bpmnModeler
    });

    expect(result.valid).toBe(false);

    expect(
      result.analyses.map(
        analysis => analysis.source.origin
      )
    ).toEqual([
      'dmn-input-header',
      'bpmn-gateway-condition'
    ]);

    const gatewayAnalysis = result.analyses.find(
      analysis =>
        analysis.source.origin ===
        'bpmn-gateway-condition'
    );

    expect(gatewayAnalysis?.result.valid).toBe(false);
    expect(gatewayAnalysis?.result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'type-mismatch',
          variable: 'age',
          from: 4,
          to: 7
        })
      ])
    );

    expect(result.variables).toEqual([
      {
        name: 'age',
        possibleTypes: ['boolean'],
        resolvedType: 'number',
        typeOrigin: 'declared',
        status: 'conflict'
      }
    ]);

    expect(result.diagnostics).toEqual([
      {
        source: gatewayAnalysis?.source,
        diagnostic: expect.objectContaining({
          code: 'type-mismatch',
          variable: 'age'
        })
      }
    ]);

    expect(result.conflicts).toEqual([
      {
        variable: result.variables[0],
        message:
          '"age" has incompatible type requirements ' +
          'across the model.',
        sources: result.analyses.map(
          analysis => analysis.source
        )
      }
    ]);
  });
});

describe('modelFeelAnalysis – Global variables', () => {
  test('combines repeated variables into one global list', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: '(amount > 0) and approved',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_2',
        gatewayId: 'Gateway_2',
        associationId: 'Association_2',
        flowId: 'Flow_2',
        targetId: 'Task_2',
        expression: '(amount < 100) and approved',
        feelKind: 'expression',
        expectedType: 'boolean'
      }
    ];

    const analyses = analyzeModelFeelSources(sources);
    const variables =
      collectModelFeelVariables(analyses);

    expect(variables).toEqual([
      {
        name: 'amount',
        possibleTypes: ['number']
      },
      {
        name: 'approved',
        possibleTypes: ['boolean']
      }
    ]);
  });

  test('detects incompatible requirements across sources', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: '(value + 1) > 0',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_2',
        gatewayId: 'Gateway_2',
        associationId: 'Association_2',
        flowId: 'Flow_2',
        targetId: 'Task_2',
        expression: 'not(value)',
        feelKind: 'expression',
        expectedType: 'boolean'
      }
    ];

    const analyses = analyzeModelFeelSources(sources);
    const variables =
      collectModelFeelVariables(analyses);

    expect(variables).toEqual([
      {
        name: 'value',
        possibleTypes: []
      }
    ]);
  });
});

describe('modelFeelAnalysis – Variable type resolution', () => {
  test('distinguishes declared, user, inferred and unresolved types', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'dmn-input-header',
        elementId: 'InputExpression_age',
        decisionId: 'Decision_1',
        tableId: 'DecisionTable_1',
        column: 0,
        expression: 'age',
        feelKind: 'expression',
        expectedType: 'number'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: '(amount > 0) and approved',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'dmn-input-header',
        elementId: 'InputExpression_status',
        decisionId: 'Decision_1',
        tableId: 'DecisionTable_1',
        column: 1,
        expression: 'status',
        feelKind: 'expression'
      }
    ];

    const userTypes = {
      approved: 'boolean'
    } as const;

    const analyses = analyzeModelFeelSources(
      sources,
      userTypes
    );

    const variables = resolveModelFeelVariables(
      analyses,
      userTypes
    );

    expect(variables).toEqual([
      {
        name: 'age',
        possibleTypes: [
          'string',
          'number',
          'boolean'
        ],
        resolvedType: 'number',
        typeOrigin: 'declared',
        status: 'resolved'
      },
      {
        name: 'amount',
        possibleTypes: ['number'],
        resolvedType: 'number',
        typeOrigin: 'inferred',
        status: 'resolved'
      },
      {
        name: 'approved',
        possibleTypes: ['boolean'],
        resolvedType: 'boolean',
        typeOrigin: 'user',
        status: 'resolved'
      },
      {
        name: 'status',
        possibleTypes: [
          'string',
          'number',
          'boolean'
        ],
        status: 'unresolved'
      }
    ]);
  });

  test('marks incompatible global requirements as a conflict', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: '(value + 1) > 0',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_2',
        gatewayId: 'Gateway_2',
        associationId: 'Association_2',
        flowId: 'Flow_2',
        targetId: 'Task_2',
        expression: 'not(value)',
        feelKind: 'expression',
        expectedType: 'boolean'
      }
    ];

    const analyses = analyzeModelFeelSources(sources);

    expect(
      resolveModelFeelVariables(analyses)
    ).toEqual([
      {
        name: 'value',
        possibleTypes: [],
        status: 'conflict'
      }
    ]);
  });
});

describe('modelFeelAnalysis – Diagnostics', () => {
  test('collects diagnostics with their source elements', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'dmn-output-cell',
        elementId: 'OutputEntry_1',
        decisionId: 'Decision_1',
        tableId: 'DecisionTable_1',
        row: 0,
        column: 0,
        expression: '"approved"',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: 'age + 1',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'dmn-input-cell',
        elementId: 'InputEntry_1',
        decisionId: 'Decision_1',
        tableId: 'DecisionTable_1',
        row: 0,
        column: 0,
        expression: '>= 18',
        feelKind: 'unaryTests',
        expectedType: 'number'
      }
    ];

    const analyses = analyzeModelFeelSources(sources);

    const diagnostics =
      collectModelFeelDiagnostics(analyses);

    expect(diagnostics).toEqual([
      {
        source: sources[0],
        diagnostic: expect.objectContaining({
          code: 'result-type-mismatch',
          from: 0,
          to: 10
        })
      },
      {
        source: sources[1],
        diagnostic: expect.objectContaining({
          code: 'result-type-mismatch',
          from: 0,
          to: 7
        })
      }
    ]);
  });
}); describe('modelFeelAnalysis – Variable conflicts', () => {
  test('groups every source involved in a global type conflict', () => {
    const sources: ModelFeelSource[] = [
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_1',
        gatewayId: 'Gateway_1',
        associationId: 'Association_1',
        flowId: 'Flow_1',
        targetId: 'Task_1',
        expression: '(value + 1) > 0',
        feelKind: 'expression',
        expectedType: 'boolean'
      },
      {
        origin: 'bpmn-gateway-condition',
        elementId: 'TextAnnotation_2',
        gatewayId: 'Gateway_2',
        associationId: 'Association_2',
        flowId: 'Flow_2',
        targetId: 'Task_2',
        expression: 'not(value)',
        feelKind: 'expression',
        expectedType: 'boolean'
      }
    ];

    const analyses = analyzeModelFeelSources(sources);

    const conflicts =
      collectModelFeelVariableConflicts(analyses);

    expect(conflicts).toEqual([
      {
        variable: {
          name: 'value',
          possibleTypes: [],
          status: 'conflict'
        },
        message:
          '"value" has incompatible type requirements ' +
          'across the model.',
        sources
      }
    ]);
  });
});
