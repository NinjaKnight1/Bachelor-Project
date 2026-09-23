import {
  syncDmnFeelMarkers
} from '../../dmn/dmnFeelMarkers';

import type {
  ModelFeelError
} from '../../modelFeelErrors';

describe('DMN FEEL markers', () => {
  test('adds and removes header and cell markers', () => {
    const container = document.createElement('div');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th data-col-id="InputClause_age"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-element-id="InputEntry_1"></td>
            <td data-element-id="OutputEntry_valid"></td>
          </tr>
        </tbody>
      </table>
    `;

    const errors: ModelFeelError[] = [
      {
        kind: 'feel',
        code: 'unsupported-expression',
        message: 'Invalid input header.',
        source: {
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
        from: 0,
        to: 3
      },
      {
        kind: 'feel',
        code: 'unary-test-type-mismatch',
        message: 'Invalid input cell.',
        source: {
          origin: 'dmn-input-cell',
          elementId: 'InputEntry_1',
          markerElementId: 'InputEntry_1',
          decisionId: 'Decision_1',
          tableId: 'DecisionTable_1',
          row: 0,
          column: 0,
          expression: '"invalid"',
          feelKind: 'unaryTests',
          expectedType: 'number'
        },
        from: 0,
        to: 9
      }
    ];

    syncDmnFeelMarkers(container, errors);

    const header = container.querySelector(
      '[data-col-id="InputClause_age"]'
    );

    const invalidCell = container.querySelector(
      '[data-element-id="InputEntry_1"]'
    );

    const validCell = container.querySelector(
      '[data-element-id="OutputEntry_valid"]'
    );

    expect(
      header?.classList.contains(
        'model-feel-dmn-error'
      )
    ).toBe(true);

    expect(header?.getAttribute('aria-invalid'))
      .toBe('true');

    expect(header?.getAttribute('title'))
      .toBe('Invalid input header.');

    expect(
      invalidCell?.classList.contains(
        'model-feel-dmn-error'
      )
    ).toBe(true);

    expect(invalidCell?.getAttribute('aria-invalid'))
      .toBe('true');

    expect(invalidCell?.getAttribute('title'))
      .toBe('Invalid input cell.');

    expect(
      validCell?.classList.contains(
        'model-feel-dmn-error'
      )
    ).toBe(false);

    syncDmnFeelMarkers(container, []);

    expect(
      header?.classList.contains(
        'model-feel-dmn-error'
      )
    ).toBe(false);

    expect(header?.hasAttribute('aria-invalid'))
      .toBe(false);

    expect(header?.hasAttribute('title'))
      .toBe(false);

    expect(
      invalidCell?.classList.contains(
        'model-feel-dmn-error'
      )
    ).toBe(false);

    expect(
      invalidCell?.hasAttribute('aria-invalid')
    ).toBe(false);
  });
});
