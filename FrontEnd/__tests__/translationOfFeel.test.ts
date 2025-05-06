import { translateFeelToSmtLib, ParseType } from '../translationOfFeel';

// describe('translationOfFeel – unary tests', () => {

//   it('handles a simple range [1..5)', () => {
//     const smt = translateFeelToSmtLib('[1..5)', parseType.Expression);
//     expect(smt).toBe('(and (>= x 1) (< x 5))');
//   });

//   it('handles comma-OR', () => {
//     const smt = translateFeelToSmtLib('"A", "B", "C"', parseType.Expression);
//     expect(smt).toBe('(or (= x "A") (= x "B") (= x "C"))');
//   });
// });

describe('translationOfFeel – arithmetic expressions', () => {

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

// describe('translationOfFeel – string expressions', () => {
//   it('handles a string', () => {
//     const smt = translateFeelToSmtLib('\"Hello World\"', parseType.Expression);
//     expect(smt).toBe(
//       'Hello World'
//     );
//   });


// });


describe('translationOfFeel – variable expressions', () => {
  it('handles a variable', () => {
    const smt = translateFeelToSmtLib('variable', ParseType.Expression);
    expect(smt).toBe(
      'variable'
    );
  });


});

//boolean expressions
describe('translationOfFeel – boolean expressions', () => {
  
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

}
);