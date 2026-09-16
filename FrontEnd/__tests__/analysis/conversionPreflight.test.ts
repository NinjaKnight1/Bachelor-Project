import {
  ConversionPurpose,
  prepareConversionVariables
} from '../../conversionPreflight';
import type { ModelFeelAnalysisResult } from '../../modelFeelAnalysis';
import { VariableTypes } from '../../translationOfADA';

function analysis(): ModelFeelAnalysisResult {
  return {
    valid: true,
    analyses: [],
    diagnostics: [],
    conflicts: [],
    variables: [
      {
        name: 'amount',
        possibleTypes: ['number'],
        resolvedType: 'number',
        typeOrigin: 'declared',
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
        name: 'category',
        possibleTypes: ['string'],
        resolvedType: 'string',
        typeOrigin: 'inferred',
        status: 'resolved'
      }
    ]
  };
}

function initialValues(): Record<string, string> {
  return {
    amount: '0',
    approved: 'false',
    category: ' premium '
  };
}

describe('conversion preflight', () => {
  test('maps resolved variables and preserves their initial values', () => {
    expect(
      prepareConversionVariables(analysis(), initialValues())
    ).toEqual({
      ok: true,
      variables: [
        { name: 'amount', type: VariableTypes.number, value: '0' },
        { name: 'approved', type: VariableTypes.boolean, value: 'false' },
        { name: 'category', type: VariableTypes.string, value: ' premium ' }
      ]
    });
  });

  test.each([
    ['amount', '', 'initial-value-required'],
    ['amount', '12abc', 'initial-value-invalid-number'],
    ['approved', 'yes', 'initial-value-invalid-boolean'],
    ['category', '"premium"', 'initial-value-quoted-string']
  ])('blocks invalid configuration for %s: %s', (name, value, code) => {
    const values = { ...initialValues(), [name]: value };

    expect(
      prepareConversionVariables(analysis(), values)
    ).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          kind: 'initial-value',
          variableName: name,
          code
        })
      ]
    });
  });

  test('blocks missing initial values', () => {
    const values = initialValues();
    delete values.amount;

    expect(
      prepareConversionVariables(analysis(), values)
    ).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: 'initial-value-required' })
      ]
    });
  });

  test('blocks unresolved types even when analysis.valid is true', () => {
    const result = analysis();
    result.variables[0] = {
      name: 'amount',
      possibleTypes: ['number', 'string'],
      status: 'unresolved'
    };

    expect(
      prepareConversionVariables(result, initialValues())
    ).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: 'initial-value-type-unresolved' })
      ]
    });
  });

  test('blocks an invalid analysis even without diagnostics', () => {
    const result = analysis();
    result.valid = false;

    expect(
      prepareConversionVariables(result, initialValues())
    ).toEqual({ ok: false, errors: [] });
  });

  test('accepts a valid model without variables', () => {
    const result = analysis();
    result.variables = [];

    expect(
      prepareConversionVariables(result, {})
    ).toEqual({ ok: true, variables: [] });
  });

  test('allows PNML conversion without initial values', () => {
    expect(
      prepareConversionVariables(analysis(), {}, ConversionPurpose.Pnml)
    ).toEqual({
      ok: true,
      variables: [
        { name: 'amount', type: VariableTypes.number, value: '' },
        { name: 'approved', type: VariableTypes.boolean, value: '' },
        { name: 'category', type: VariableTypes.string, value: '' }
      ]
    });
  });

  test('ignores initial-value errors for PNML only', () => {
    const values = {
      amount: 'not a number',
      approved: 'yes',
      category: '"premium"'
    };

    expect(
      prepareConversionVariables(analysis(), values, ConversionPurpose.Pnml).ok
    ).toBe(true);

    expect(
      prepareConversionVariables(analysis(), values, ConversionPurpose.ModelChecking).ok
    ).toBe(false);
  });

  test('still blocks unresolved types for PNML', () => {
    const result = analysis();
    result.variables[0] = {
      name: 'amount',
      possibleTypes: ['number', 'string'],
      status: 'unresolved'
    };

    expect(
      prepareConversionVariables(result, {}, ConversionPurpose.Pnml)
    ).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          variableName: 'amount',
          code: 'initial-value-type-unresolved'
        })
      ]
    });
  });

  test('still blocks type conflicts for PNML', () => {
    const result = analysis();
    result.valid = false;
    result.variables[0] = {
      name: 'amount',
      possibleTypes: [],
      status: 'conflict'
    };
    result.conflicts = [{
      variable: result.variables[0],
      message: 'amount has incompatible type requirements.',
      sources: []
    }];

    expect(
      prepareConversionVariables(result, {}, ConversionPurpose.Pnml)
    ).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          kind: 'conflict',
          variableName: 'amount'
        })
      ]
    });
  });
});
