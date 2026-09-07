import {
  ParseType,
  translateFeelToSmtLib
} from '../translationOfADA';

describe('translationOfADA – Expressions', () => {
  describe('Logical expressions', () => {
    test.each([
      [
        'approved and active',
        '(approved && active)',
        ['approved', 'active']
      ],
      [
        'approved or active',
        '(approved || active)',
        ['approved', 'active']
      ],
      [
        'approved or active and verified',
        '(approved || (active && verified))',
        ['approved', 'active', 'verified']
      ],
      [
        '(approved or active) and verified',
        '((approved || active) && verified)',
        ['approved', 'active', 'verified']
      ],
      [
        '(age > 18) and approved = true',
        '((age > 18) && (approved == true))',
        ['age', 'approved']
      ]
    ])(
      'translates %s',
      (
        feelExpression,
        expectedTranslation,
        expectedVariables
      ) => {
        const [translation, variables] =
          translateFeelToSmtLib(
            feelExpression,
            ParseType.Expression
          );

        expect(translation).toBe(expectedTranslation);
        expect(Array.from(variables)).toEqual(
          expectedVariables
        );
      }
    );
  });
});