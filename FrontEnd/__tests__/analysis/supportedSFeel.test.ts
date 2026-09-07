import { validateSupportedSFeel, type SupportedVariableType } from '../../supportedSFeel';

describe('supportedSFeel', () => {
  describe('Variable types', () => {
    test('infers Boolean when a variable is used with not', () => {
      const result = validateSupportedSFeel('not(approved)');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'approved',
          possibleTypes: ['boolean']
        }
      ]);
    });

    test('infers Number from a comparison with a number', () => {
      const result = validateSupportedSFeel('age >= 18');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'age',
          possibleTypes: ['number']
        }
      ]);
    });

    test('allows not around a Boolean comparison', () => {
      const result = validateSupportedSFeel('not(age >= 18)');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'age',
          possibleTypes: ['number']
        }
      ]);
    });

    test('returns all possible types when the type cannot be inferred', () => {
      const result = validateSupportedSFeel(
        'leftValue = rightValue'
      );

      expect(result.valid).toBe(false);
      expect(result.variables).toEqual([
        {
          name: 'leftValue',
          possibleTypes: ['string', 'number', 'boolean']
        },
        {
          name: 'rightValue',
          possibleTypes: ['string', 'number', 'boolean']
        }
      ]);

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-required'
          })
        ])
      );
    });

    test('reports a mismatch when not receives a known Number', () => {
      const result = validateSupportedSFeel('not(amount)', {
        variableTypes: {
          amount: 'number'
        }
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch',
            variable: 'amount'
          })
        ])
      );
    });
  });

  describe('Expression profile', () => {
    test.each([
      ['number arithmetic', 'price + 10'],
      ['number comparison', 'age < 65'],
      ['string equality', 'status = "approved"'],
      ['Boolean equality', 'approved = true'],
      ['parenthesized expression', '(age >= 18)']
    ])('accepts %s', (_description, expression) => {
      const result = validateSupportedSFeel(expression);

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });

    test('rejects functions other than not', () => {
      const result = validateSupportedSFeel('sum(values)');

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-function'
          })
        ])
      );
    });

    test.each([
      ['date("2026-08-29")'],
      ['if approved then 1 else 0']
    ])('rejects unsupported expression: %s', expression => {
      const result = validateSupportedSFeel(expression);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-expression'
          })
        ])
      );
    });
  });
  describe('Supported unary tests', () => {
    test.each([
      ['wildcard', '-'],
      ['numeric comparison', '> 18'],
      ['multiple string alternatives', '"A", "B"'],
      ['numeric interval', '[1..5]'],
      ['negated comparison', 'not(> 10)']
    ])('accepts %s', (_description, unaryTest) => {
      const result = validateSupportedSFeel(unaryTest, {
        kind: 'unaryTests'
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('Unsupported unary tests', () => {
    test('rejects date values', () => {
      const result = validateSupportedSFeel(
        'date("2026-08-29")',
        {
          kind: 'unaryTests'
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-expression'
          })
        ])
      );
    });

    test('rejects functions other than not', () => {
      const result = validateSupportedSFeel('sum(values)', {
        kind: 'unaryTests',
        variableTypes: {
          values: 'number'
        }
      });

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-function'
          })
        ])
      );
    });
  });

  describe('Related variable types', () => {
    test('infers Number for both arithmetic operands', () => {
      const result = validateSupportedSFeel('left + right');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'left',
          possibleTypes: ['number']
        },
        {
          name: 'right',
          possibleTypes: ['number']
        }
      ]);
      expect(result.diagnostics).toEqual([]);
    });

    test('infers Number for both ordered-comparison operands', () => {
      const result = validateSupportedSFeel('lower < upper');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'lower',
          possibleTypes: ['number']
        },
        {
          name: 'upper',
          possibleTypes: ['number']
        }
      ]);
      expect(result.diagnostics).toEqual([]);
    });

    test.each<SupportedVariableType>([
      'string',
      'number',
      'boolean'
    ])(
      'propagates a selected %s type through equality',
      selectedType => {
        const result = validateSupportedSFeel(
          'leftValue = rightValue',
          {
            variableTypes: {
              leftValue: selectedType
            }
          }
        );

        expect(result.valid).toBe(true);
        expect(result.variables).toEqual([
          {
            name: 'leftValue',
            possibleTypes: [selectedType]
          },
          {
            name: 'rightValue',
            possibleTypes: [selectedType]
          }
        ]);
        expect(result.diagnostics).toEqual([]);
      }
    );

    test('reports conflicting types used in equality', () => {
      const result = validateSupportedSFeel(
        'leftValue = rightValue',
        {
          variableTypes: {
            leftValue: 'string',
            rightValue: 'number'
          }
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch'
          })
        ])
      );
    });
  });

  describe('Logical operators', () => {
    test.each([
      'and',
      'or'
    ] as const)(
      'infers Boolean operands for %s',
      operator => {
        const result = validateSupportedSFeel(
          `approved ${operator} active`
        );

        expect(result.valid).toBe(true);
        expect(result.variables).toEqual([
          {
            name: 'active',
            possibleTypes: ['boolean']
          },
          {
            name: 'approved',
            possibleTypes: ['boolean']
          }
        ]);
        expect(result.diagnostics).toEqual([]);
      }
    );

    test('preserves types inside a Boolean comparison', () => {
      const result = validateSupportedSFeel(
        '(age > 18) and approved'
      );

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        {
          name: 'age',
          possibleTypes: ['number']
        },
        {
          name: 'approved',
          possibleTypes: ['boolean']
        }
      ]);
      expect(result.diagnostics).toEqual([]);
    });

    test('rejects a known Number used as a Boolean operand', () => {
      const result = validateSupportedSFeel(
        'approved and amount',
        {
          variableTypes: {
            amount: 'number'
          }
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch',
            variable: 'amount'
          })
        ])
      );
    });
  });

  describe('Unsupported expression forms', () => {
    test.each([
      ['list', '[1, 2, 3]'],
      ['context', '{ name: "Chris" }'],
      ['path access', 'person.name'],
      ['filter', 'items[1]'],
      ['for expression', 'for x in [1, 2] return x'],
      [
        'quantified expression',
        'some x in [1, 2] satisfies x > 1'
      ],
      ['null literal', 'null']
    ])('rejects %s', (_description, expression) => {
      const result = validateSupportedSFeel(expression);

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-expression'
          })
        ])
      );
    });
  });

  describe('Diagnostic positions', () => {
    test('reports the position of a syntax error', () => {
      const result = validateSupportedSFeel('age >');

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'syntax-error',
            from: 5,
            to: 5
          })
        ])
      );
    });

    test('reports the range of an unsupported expression', () => {
      const result = validateSupportedSFeel('[1, 2, 3]');

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-expression',
            from: 0,
            to: 9
          })
        ])
      );
    });

    test('reports the range of an unsupported function name', () => {
      const result = validateSupportedSFeel('sum(values)', {
        variableTypes: {
          values: 'number'
        }
      });

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unsupported-function',
            from: 0,
            to: 3
          })
        ])
      );
    });

    test('reports the range of a variable with a type mismatch', () => {
      const result = validateSupportedSFeel('not(amount)', {
        variableTypes: {
          amount: 'number'
        }
      });

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-mismatch',
            variable: 'amount',
            from: 4,
            to: 10
          })
        ])
      );
    });

    test('reports the range of each variable requiring a type', () => {
      const result = validateSupportedSFeel(
        'leftValue = rightValue'
      );

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'type-required',
            variable: 'leftValue',
            from: 0,
            to: 9
          }),
          expect.objectContaining({
            code: 'type-required',
            variable: 'rightValue',
            from: 12,
            to: 22
          })
        ])
      );
    });
  });
  describe('Result type inference', () => {
    test.each([
      ['number literal', '10', ['number']],
      ['string literal', '"approved"', ['string']],
      ['Boolean literal', 'true', ['boolean']],
      ['arithmetic', 'price + 1', ['number']],
      ['comparison', 'age >= 18', ['boolean']],
      [
        'logical expression',
        'approved and active',
        ['boolean']
      ]
    ])(
      'infers the result type of %s',
      (_description, expression, expectedTypes) => {
        const result = validateSupportedSFeel(expression);

        expect(result).toEqual(
          expect.objectContaining({
            possibleResultTypes: expectedTypes
          })
        );
      }
    );

    test('uses a selected variable type as the result type', () => {
      const result = validateSupportedSFeel('status', {
        variableTypes: {
          status: 'string'
        }
      });

      expect(result).toEqual(
        expect.objectContaining({
          possibleResultTypes: ['string']
        })
      );
    });

    test('treats unary tests as Boolean results', () => {
      const result = validateSupportedSFeel('> 18', {
        kind: 'unaryTests'
      });

      expect(result).toEqual(
        expect.objectContaining({
          possibleResultTypes: ['boolean']
        })
      );
    });
  });
  describe('Expected result type', () => {
    test('accepts an expression with the expected result type', () => {
      const result = validateSupportedSFeel(
        'age >= 18',
        {
          expectedResultType: 'boolean'
        }
      );

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });

    test('reports an unexpected result type', () => {
      const result = validateSupportedSFeel(
        'age + 1',
        {
          expectedResultType: 'boolean'
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'result-type-mismatch',
            from: 0,
            to: 7
          })
        ])
      );
    });

    test('reports a string used where Boolean is expected', () => {
      const result = validateSupportedSFeel(
        '"approved"',
        {
          expectedResultType: 'boolean'
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'result-type-mismatch',
            from: 0,
            to: 10
          })
        ])
      );
    });
  });
  describe('Expected unary-test input type', () => {
    test('accepts values matching the input type', () => {
      const result = validateSupportedSFeel(
        '>= 18',
        {
          kind: 'unaryTests',
          expectedUnaryTestInputType: 'number'
        }
      );

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });

    test('rejects values that do not match the input type', () => {
      const result = validateSupportedSFeel(
        '"Winter"',
        {
          kind: 'unaryTests',
          expectedUnaryTestInputType: 'number'
        }
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unary-test-type-mismatch',
            from: 0,
            to: 8
          })
        ])
      );
    });

    test('allows the wildcard for every input type', () => {
      const result = validateSupportedSFeel(
        '-',
        {
          kind: 'unaryTests',
          expectedUnaryTestInputType: 'boolean'
        }
      );

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });
  });
});

