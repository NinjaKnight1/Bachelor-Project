import { translateFeelToSmtLib, ParseType } from '../translationOfFeel';

describe('translationOfFeel – Unary tests', () => {
  describe('Interval', () => {

    // --------- Interval ---------
    it('handles a range [1..5)', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('[1..5)', ParseType.Unary, 'x');
      expect(translatedExpression).toBe('(and (>= x 1) (< x 5))');
    });

    it.each([
      ['[1..5]', '(and (>= x 1) (<= x 5))'],
      ['(1..5]', '(and (> x 1) (<= x 5))'],
      ['(1..5)', '(and (> x 1) (< x 5))'],
      ['(3+foo..5)', '(and (> x (+ 3 foo)) (< x 5))'],
      ['[foo..bar)', '(and (>= x foo) (< x bar))'],
    ])('handles interval %s', (feelText, smtExpectedText) => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib(feelText, ParseType.Unary, 'x');
      expect(translatedExpression).toBe(smtExpectedText);
    });
  });

  // --------- a single value ---------
  it('handles strings', () => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib('"A"', ParseType.Unary, 'x');
    expect(translatedExpression).toBe('(= x "A")');
  });

  it('handles numbers', () => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib('"3"', ParseType.Unary, 'x');
    expect(translatedExpression).toBe('(= x "3")');
  });

  it('handles variables', () => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib('foo', ParseType.Unary, 'x');
    expect(translatedExpression).toBe('(= x foo)');
  });

  it('handles booleans', () => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib('true', ParseType.Unary, 'x');
    expect(translatedExpression).toBe('(= x true)');
  });

  // --------- empty (-) ---------
  it('handles a \'-\'', () => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib('-', ParseType.Unary, 'x');
    expect(translatedExpression).toBe('true');
  });

  describe('Comparisons', () => {

    // --------- Comparisons ---------
    it('handles a numeric > comparison ', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('> 3', ParseType.Unary, 'x');
      expect(translatedExpression).toBe('(> x 3)');
    });

    it.each([
      ['< 5', '(< x 5)'],
      ['<= 5', '(<= x 5)'],
      ['>= 5', '(>= x 5)'],
    ])('handles a numeric %s comparison', (feelText, smtExpectedText) => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib(feelText, ParseType.Unary, 'x');
      expect(translatedExpression).toBe(smtExpectedText);
    });

    it.each([
      ['> foo', '(> x foo)'],
      ['< foo', '(< x foo)'],
      ['<= foo', '(<= x foo)'],
      ['>= foo', '(>= x foo)'],
    ])('handles a variable %s comparison', (feelText, smtExpectedText) => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib(feelText, ParseType.Unary, 'x');
      expect(translatedExpression).toBe(smtExpectedText);
    });

  });
  describe('Comma-or', () => {

    // --------- Comma/or ---------
    // Comma/or, which means one of the elements in the list should be true
    it('handles comma-or with string', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('"A", "B", "C"', ParseType.Unary, 'x');
      expect(translatedExpression).toBe('(or (= x "A") (or (= x "B") (= x "C")))');
    });

    it('handles comma-or with numbers', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3, 1, 4', ParseType.Unary, 'x');
      expect(translatedExpression).toBe('(or (= x 3) (or (= x 1) (= x 4)))');
    });

    it('handles comma-or with comparisons', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('> 3, >= 1, <4, <= 2', ParseType.Unary, 'x');
      expect(translatedExpression).toBe('(or (> x 3) (or (>= x 1) (or (< x 4) (<= x 2))))');
    });
  });
});

describe('translationOfFeel – Expressions', () => {
  describe('translationOfFeel – Arithmetic expressions', () => {
    it('handles a simple number', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3', ParseType.Expression);
      expect(translatedExpression).toBe(
        '3'
      );
    });

    it('handles a longer number', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('33142213413', ParseType.Expression);
      expect(translatedExpression).toBe(
        '33142213413'
      );
    });

    it('handles addition of two numbers', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3+3', ParseType.Expression);
      expect(translatedExpression).toBe(
        '(+ 3 3)'
      );
    });

    it('handles subtraction of two numbers', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3-3', ParseType.Expression);
      expect(translatedExpression).toBe(
        '(- 3 3)'
      );
    });

    it('handles multiplication of two numbers', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3*3', ParseType.Expression);
      expect(translatedExpression).toBe(
        '(* 3 3)'
      );
    });

    it('handles division of two numbers', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('3/3', ParseType.Expression);
      expect(translatedExpression).toBe(
        '(/ 3 3)'
      );
    });

    it('handles parentheses', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('(3+3)', ParseType.Expression);
      expect(translatedExpression).toBe(
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
    let [translatedExpression, variableNameList] = translateFeelToSmtLib(feelText, ParseType.Expression);
    expect(translatedExpression).toBe(smtExpectedText);
  });

  it.each([
    ['boo > foo', '(> boo foo)'],
    ['boo < foo', '(< boo foo)'],
    ['boo <= foo', '(<= boo foo)'],
    ['boo >= foo', '(>= boo foo)'],
  ])('handles a variable %s comparison', (feelText, smtExpectedText) => {
    let [translatedExpression, variableNameList] = translateFeelToSmtLib(feelText, ParseType.Expression);
    expect(translatedExpression).toBe(smtExpectedText);
  });

  describe('translationOfFeel – string expressions', () => {
    it('handles a string', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('"Hello World"', ParseType.Expression);
      expect(translatedExpression).toBe(
        '"Hello World"'
      );
    });


  });


  describe('translationOfFeel – Variable expressions', () => {
    it('handles a variable', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('variable', ParseType.Expression);
      expect(translatedExpression).toBe(
        'variable'
      );
    });


  });

  //boolean expressions
  describe('translationOfFeel – Boolean expressions', () => {

    it('handles a boolean', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('true', ParseType.Expression);
      expect(translatedExpression).toBe(
        'true'
      );
    });

    it('handles a boolean', () => {
      let [translatedExpression, variableNameList] = translateFeelToSmtLib('false', ParseType.Expression);
      expect(translatedExpression).toBe(
        'false'
      );
    });
  });
});

