import {
  validateModelFeelInitialValue
} from '../../initialValueValidation';

import type {
  ResolvedModelFeelVariable
} from '../../modelFeelAnalysis';

function resolvedVariable(
  name: string,
  resolvedType: 'string' | 'number' | 'boolean'
): ResolvedModelFeelVariable {
  return {
    name,
    possibleTypes: [resolvedType],
    resolvedType,
    typeOrigin: 'inferred',
    status: 'resolved'
  };
}

describe('initial-value validation', () => {
  test.each([
    undefined,
    '',
    '   '
  ])('requires an initial value', value => {
    const diagnostic =
      validateModelFeelInitialValue(
        resolvedVariable('age', 'number'),
        value
      );

    expect(diagnostic).toEqual(
      expect.objectContaining({
        code: 'initial-value-required',
        variableName: 'age'
      })
    );
  });

  test.each([
    '0',
    '-3.5',
    '+12',
    '.5',
    '1e3'
  ])('accepts numeric value %s', value => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('amount', 'number'),
        value
      )
    ).toBeUndefined();
  });

  test.each([
    '12abc',
    'Infinity',
    'NaN',
    '--1'
  ])('rejects invalid numeric value %s', value => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('amount', 'number'),
        value
      )
    ).toEqual(
      expect.objectContaining({
        code: 'initial-value-invalid-number',
        variableName: 'amount'
      })
    );
  });

  test.each([
    'true',
    'false'
  ])('accepts Boolean value %s', value => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('approved', 'boolean'),
        value
      )
    ).toBeUndefined();
  });

  test.each([
    'True',
    'FALSE',
    'yes',
    '1'
  ])('rejects invalid Boolean value %s', value => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('approved', 'boolean'),
        value
      )
    ).toEqual(
      expect.objectContaining({
        code: 'initial-value-invalid-boolean',
        variableName: 'approved'
      })
    );
  });

  test('accepts raw string values', () => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('category', 'string'),
        'premium'
      )
    ).toBeUndefined();
  });

  test('rejects quoted string values', () => {
    expect(
      validateModelFeelInitialValue(
        resolvedVariable('category', 'string'),
        '"premium"'
      )
    ).toEqual(
      expect.objectContaining({
        code: 'initial-value-quoted-string',
        variableName: 'category'
      })
    );
  });

  test.each([
    {
      name: 'category',
      possibleTypes: ['string', 'number'],
      status: 'unresolved'
    },
    {
      name: 'category',
      possibleTypes: [],
      status: 'conflict'
    }
  ] as ResolvedModelFeelVariable[])(
    'requires a resolved variable type',
    variable => {
      expect(
        validateModelFeelInitialValue(
          variable,
          'premium'
        )
      ).toEqual(
        expect.objectContaining({
          code: 'initial-value-type-unresolved',
          variableName: 'category'
        })
      );
    }
  );
});
