import { translateFeelToSmtLib, ParseType } from '../translationOfFeel';

describe('translationOfFeel – Unary tests', () => {
  describe('Interval', () => {

    // --------- Interval ---------
    it('handles a range [1..5)', () => {
      const smt = translateFeelToSmtLib('[1..5)', ParseType.Unary, 'x');
      expect(smt).toBe('(and (>= x 1) (< x 5))');
    });

    it.each([
      ['[1..5]', '(and (>= x 1) (<= x 5))'],
      ['(1..5]', '(and (> x 1) (<= x 5))'],
      ['(1..5)', '(and (> x 1) (< x 5))'],
      ['(3+foo..5)', '(and (> x (+ 3 foo)) (< x 5))'],
      ['[foo..bar)', '(and (>= x foo) (< x bar))'],
    ])('handles interval %s', (feelText, smtExpectedText) => {
      expect(translateFeelToSmtLib(feelText, ParseType.Unary, 'x')).toBe(smtExpectedText);
    });
  });

  // --------- a single value ---------
  it('handles strings', () => {
    const smt = translateFeelToSmtLib('"A"', ParseType.Unary, 'x');
    expect(smt).toBe('(= x "A")');
  });

  it('handles numbers', () => {
    const smt = translateFeelToSmtLib('"3"', ParseType.Unary, 'x');
    expect(smt).toBe('(= x "3")');
  });

  it('handles variables', () => {
    const smt = translateFeelToSmtLib('foo', ParseType.Unary, 'x');
    expect(smt).toBe('(= x foo)');
  });

  it('handles booleans', () => {
    const smt = translateFeelToSmtLib('true', ParseType.Unary, 'x');
    expect(smt).toBe('(= x true)');
  });

  // --------- empty (-) ---------
  it('handles a \'-\'', () => {
    const smt = translateFeelToSmtLib('-', ParseType.Unary, 'x');
    expect(smt).toBe('true');
  });

  describe('Comparisons', () => {

    // --------- Comparisons ---------
    it('handles a numeric > comparison ', () => {
      const smt = translateFeelToSmtLib('> 3', ParseType.Unary, 'x');
      expect(smt).toBe('(> x 3)');
    });

    it.each([
      ['< 5', '(< x 5)'],
      ['<= 5', '(<= x 5)'],
      ['>= 5', '(>= x 5)'],
    ])('handles a numeric %s comparison', (feelText, smtExpectedText) => {
      expect(translateFeelToSmtLib(feelText, ParseType.Unary, 'x')).toBe(smtExpectedText);
    });

    it.each([
      ['> foo', '(> x foo)'],
      ['< foo', '(< x foo)'],
      ['<= foo', '(<= x foo)'],
      ['>= foo', '(>= x foo)'],
    ])('handles a variable %s comparison', (feelText, smtExpectedText) => {
      expect(translateFeelToSmtLib(feelText, ParseType.Unary, 'x')).toBe(smtExpectedText);
    });

  });
  describe('Comma-or', () => {

    // --------- Comma/or ---------
    // Comma/or, which means one of the elements in the list should be true
    it('handles comma-or with string', () => {
      const smt = translateFeelToSmtLib('"A", "B", "C"', ParseType.Unary, 'x');
      expect(smt).toBe('(or (= x "A") (or (= x "B") (= x "C")))');
    });

    it('handles comma-or with numbers', () => {
      const smt = translateFeelToSmtLib('3, 1, 4', ParseType.Unary, 'x');
      expect(smt).toBe('(or (= x 3) (or (= x 1) (= x 4)))');
    });

    it('handles comma-or with comparisons', () => {
      const smt = translateFeelToSmtLib('> 3, >= 1, <4, <= 2', ParseType.Unary, 'x');
      expect(smt).toBe('(or (> x 3) (or (>= x 1) (or (< x 4) (<= x 2))))');
    });
  });
});

describe('translationOfFeel – Expressions', () => {
  describe('translationOfFeel – Arithmetic expressions', () => {
    it('handles a simple number', () => {
      const smt = translateFeelToSmtLib('3', ParseType.Expression);
      expect(smt).toBe(
        '3'
      );
    });

    it('handles a longer number', () => {
      const smt = translateFeelToSmtLib('33142213413', ParseType.Expression);
      expect(smt).toBe(
        '33142213413'
      );
    });

    it('handles addition of two numbers', () => {
      const smt = translateFeelToSmtLib('3+3', ParseType.Expression);
      expect(smt).toBe(
        '(+ 3 3)'
      );
    });

    it('handles subtraction of two numbers', () => {
      const smt = translateFeelToSmtLib('3-3', ParseType.Expression);
      expect(smt).toBe(
        '(- 3 3)'
      );
    });

    it('handles multiplication of two numbers', () => {
      const smt = translateFeelToSmtLib('3*3', ParseType.Expression);
      expect(smt).toBe(
        '(* 3 3)'
      );
    });

    it('handles division of two numbers', () => {
      const smt = translateFeelToSmtLib('3/3', ParseType.Expression);
      expect(smt).toBe(
        '(/ 3 3)'
      );
    });

    it('handles parentheses', () => {
      const smt = translateFeelToSmtLib('(3+3)', ParseType.Expression);
      expect(smt).toBe(
        '(+ 3 3)'
      );
    });
  });

  it.each([
    ['4 > 5', '(> 4 5)'],
    ['4 < 5', '(< 4 5)'],
    ['4 <= 5', '(<= 4 5)'],
    ['4 >= 5', '(>= 4 5)'],
  ])('handles a numeric %s comparison', (feelText, smtExpectedText) => {
    expect(translateFeelToSmtLib(feelText, ParseType.Expression)).toBe(smtExpectedText);
  });

  it.each([
    ['boo > foo', '(> boo foo)'],
    ['boo < foo', '(< boo foo)'],
    ['boo <= foo', '(<= boo foo)'],
    ['boo >= foo', '(>= boo foo)'],
  ])('handles a variable %s comparison', (feelText, smtExpectedText) => {
    expect(translateFeelToSmtLib(feelText, ParseType.Expression)).toBe(smtExpectedText);
  });

  describe('translationOfFeel – string expressions', () => {
    it('handles a string', () => {
      const smt = translateFeelToSmtLib('"Hello World"', ParseType.Expression);
      expect(smt).toBe(
        '"Hello World"'
      );
    });


  });


  describe('translationOfFeel – Variable expressions', () => {
    it('handles a variable', () => {
      const smt = translateFeelToSmtLib('variable', ParseType.Expression);
      expect(smt).toBe(
        'variable'
      );
    });


  });

  //boolean expressions
  describe('translationOfFeel – Boolean expressions', () => {

    it('handles a boolean', () => {
      const smt = translateFeelToSmtLib('true', ParseType.Expression);
      expect(smt).toBe(
        'true'
      );
    });

    it('handles a boolean', () => {
      const smt = translateFeelToSmtLib('false', ParseType.Expression);
      expect(smt).toBe(
        'false'
      );
    });
  });
});

