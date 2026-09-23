import {
  buildDpnForConversion,
  ConversionValidationError,
  formatConversionError
} from '../modelConversion';
import { ModelFeelAnalysisState } from '../modelFeelAnalysisState';
import { TranslationError } from '../customErrors';
import { dpnToModelChecking } from '../bpmnToDpnConversion/dpnToModelChecking';
import * as conversion from '../bpmnToDpnConversion/dbpmnToDpn';
import { readFileSync } from 'fs';
import { join } from 'path';
import DmnModeler from 'dmn-js/dist/dmn-modeler.development.js';
import { ConversionPurpose } from '../conversionPreflight';

// Fail if the conversion path imports the old panel.
jest.mock('../variablePanel', () => {
  throw new Error('Conversion must not depend on the legacy variable panel.');
});

function setup() {
  const state = new ModelFeelAnalysisState();
  state.setInitialValue('amount', '42');

  const definitions = { rootElements: [], diagrams: [] };
  const bpmnModeler = {
    _definitions: definitions,
    getDefinitions: () => definitions
  };

  const inputExpression: { text: string; typeRef?: string } = {
    text: 'amount',
    typeRef: 'number'
  };

  const decision = {
    id: 'Decision_1',
    decisionLogic: {
      id: 'Table_1',
      hitPolicy: 'UNIQUE',
      input: [{ id: 'Input_1', inputExpression }],
      output: [],
      rule: []
    }
  };

  const dmnModeler = {
    getViews: () => [
      { type: 'decisionTable', element: decision }
    ]
  };

  return {
    options: {
      bpmnModeler,
      dmnModeler,
      state,
      purpose: ConversionPurpose.ModelChecking
    },
    inputExpression
  };
}

describe('model conversion', () => {
  test.each([
    [ConversionPurpose.Pnml, ['amount']],
    [ConversionPurpose.ModelChecking, []],
  ])(
    'passes startup inputs according to purpose: %s',
    async (purpose, expectedInputs) => {
      const { options } = setup();
      options.state.setProcessInput('amount', true);
      options.state.setProcessInput('removedVariable', true);
      const convert = jest.spyOn(conversion, 'bpmnToPn');
      await buildDpnForConversion({ ...options, purpose });
      expect(convert).toHaveBeenCalledWith(
        options.bpmnModeler,
        options.dmnModeler,
        expect.any(Array),
        expectedInputs,
      );
      expect(options.state.getInitialValues()).toEqual({ amount: '42' });
    },
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('carries state values into ADA JSON', async () => {
    const { options } = setup();

    const dpn = await buildDpnForConversion(options);

    expect(dpnToModelChecking(dpn).variables).toEqual([
      { name: 'amount', initial: 42, type: 'rat' }
    ]);
    expect(options.state.getResult().variables).toEqual([
      expect.objectContaining({
        name: 'amount',
        resolvedType: 'number',
        status: 'resolved'
      })
    ]);
  });

  test('uses a user-selected type when DMN does not declare one', async () => {
    const { options, inputExpression } = setup();
    inputExpression.typeRef = undefined;
    options.state.setUserType('amount', 'boolean');
    options.state.setInitialValue('amount', 'false');

    const dpn = await buildDpnForConversion(options);

    expect(dpnToModelChecking(dpn).variables).toEqual([
      { name: 'amount', initial: false, type: 'bool' }
    ]);
  });

  test.each([
    [undefined, 'initial-value-required'],
    ['not a number', 'initial-value-invalid-number']
  ])('blocks invalid model-checking input: %s', async (value, code) => {
    const { options } = setup();
    options.state.setInitialValue('amount', value);
    const convert = jest.spyOn(conversion, 'bpmnToPn');

    await expect(buildDpnForConversion(options)).rejects.toMatchObject({
      name: 'ConversionValidationError',
      errors: [
        expect.objectContaining({
          variableName: 'amount',
          code
        })
      ]
    });

    expect(convert).not.toHaveBeenCalled();
  });

  test('allows PNML conversion without an initial value', async () => {
    const { options } = setup();
    options.state.setInitialValue('amount', undefined);

    const dpn = await buildDpnForConversion({
      ...options,
      purpose: ConversionPurpose.Pnml
    });

    expect(dpn.variables).toEqual([
      { name: 'amount', type: 'number', value: '' }
    ]);
  });

  test('reanalyzes edited expressions instead of trusting cached results', async () => {
    const { options, inputExpression } = setup();

    await buildDpnForConversion(options);
    expect(options.state.getResult().valid).toBe(true);

    inputExpression.text = 'date("2026-01-01")';
    const convert = jest.spyOn(conversion, 'bpmnToPn');

    await expect(buildDpnForConversion(options))
      .rejects.toBeInstanceOf(ConversionValidationError);

    expect(options.state.getResult().valid).toBe(false);
    expect(convert).not.toHaveBeenCalled();
  });

  test('reads unopened tables and committed edits without reimporting', async () => {
    const dmnModeler = new DmnModeler({
      container: document.createElement('div')
    });

    try {
      const xml = readFileSync(
        join(
          __dirname,
          '../../Diagrams/Parallel_Example/decision-table.dmn'
        ),
        'utf-8'
      );

      // Load the document without opening a decision table.
      await dmnModeler.importXML(xml, { open: false });

      const saveXml = jest.spyOn(dmnModeler, 'saveXML');
      const importXml = jest.spyOn(dmnModeler, 'importXML');

      const { options } = setup();
      const currentOptions = {
        ...options,
        dmnModeler,
        purpose: ConversionPurpose.Pnml
      };

      const initialDpn = await buildDpnForConversion(currentOptions);

      // Variables from both unopened tables must be included.
      expect(initialDpn.variables.map(variable => variable.name))
        .toEqual(expect.arrayContaining([
          'Num',
          'Confirm',
          'Weather',
          'Clothing'
        ]));

      const view = dmnModeler.getViews().find(
        (candidate: { id: string }) =>
          candidate.id === 'Activity_12h1ym2'
      );

      await dmnModeler.open(view);

      const viewer = dmnModeler.getActiveViewer();
      const commandStack = viewer.get('commandStack');
      const inputExpression =
        view.element.decisionLogic.input[0].inputExpression;

      viewer.get('modeling').editInputExpression(
        inputExpression,
        { text: 'UpdatedNum' }
      );

      const editedDpn = await buildDpnForConversion(currentOptions);
      const editedNames = editedDpn.variables.map(variable => variable.name);

      expect(editedNames).toContain('UpdatedNum');
      expect(editedNames).not.toContain('Num');
      expect(commandStack.canUndo()).toBe(true);

      commandStack.undo();

      const restoredDpn = await buildDpnForConversion(currentOptions);
      const restoredNames =
        restoredDpn.variables.map(variable => variable.name);

      expect(restoredNames).toContain('Num');
      expect(restoredNames).not.toContain('UpdatedNum');
      expect(saveXml).not.toHaveBeenCalled();
      expect(importXml).not.toHaveBeenCalled();
    } finally {
      dmnModeler.destroy();
    }
  });

  test('formats translation details for the action error messages', () => {
    const error = new TranslationError([
      'Unsupported guard.',
      new Error('Invalid output.')
    ]);

    expect(formatConversionError(error)).toBe(
      'Error in decision table translation\n' +
      'Unsupported guard.\n' +
      'Invalid output.'
    );
  });

  test('provides a message when invalid analysis has no diagnostics', () => {
    const error = new ConversionValidationError([]);

    expect(formatConversionError(error)).toBe(
      'Conversion blocked because the model analysis is invalid.'
    );
  });
});
