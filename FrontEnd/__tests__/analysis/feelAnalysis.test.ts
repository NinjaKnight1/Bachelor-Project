import { analyzeFeelExpression } from '../../feelAnalysis';

describe('analyzeFeelExpression', () => {
  describe('FEEL expressions', () => {
    it('extracts a variable and infers its number type', () => {
      const result = analyzeFeelExpression('age >= 18');

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.variables).toContainEqual({
        name: 'age',
        type: 'Number'
      });
    });

    it('extracts a variable and infers its boolean type', () => {
      const result = analyzeFeelExpression('approved = true');

      expect(result.valid).toBe(true);
      expect(result.variables).toContainEqual({
        name: 'approved',
        type: 'Boolean'
      });
    });

    it('leaves the type unspecified when it cannot be inferred', () => {
      const result = analyzeFeelExpression(
        'customerStatus = expectedStatus'
      );

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        { name: 'customerStatus' },
        { name: 'expectedStatus' }
      ]);
    });

    it('does not treat a built-in function as a variable', () => {
      const result = analyzeFeelExpression('sum(values) > 10');

      expect(result.valid).toBe(true);
      expect(result.variables).toEqual([
        { name: 'values' }
      ]);
      expect(result.functions).toContainEqual({
        name: 'sum',
        type: 'builtin',
        from: 0,
        to: 3
      });
    });
  });

  describe('DMN unary tests', () => {
    it('recognizes a comparison as a valid unary test', () => {
      const result = analyzeFeelExpression('> 18', 'unaryTests');

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });

    it('recognizes the wildcard as a valid unary test', () => {
      const result = analyzeFeelExpression('-', 'unaryTests');

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    });
  });

  describe('diagnostics', () => {
    it('returns the position of a syntax error', () => {
      const result = analyzeFeelExpression('age >');

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          from: 5,
          to: 5,
          severity: 'error'
        })
      );
    });
  });
});
