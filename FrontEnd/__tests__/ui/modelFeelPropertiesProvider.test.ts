import {
  ModelFeelErrorEntry,
  ModelFeelPropertiesProvider,
  VariableInitialValueEntry,
  VariableHeadingEntry,
  VariableProcessInputEntry,
  VariableTypeEntry
} from '../../bpmn/modelFeelPropertiesProvider';

import {
  CheckboxEntry,
  DescriptionEntry,
  SelectEntry,
  TextFieldEntry
} from '@bpmn-io/properties-panel';

import type {
  ModelFeelAnalysisResult
} from '../../modelFeelAnalysis';

jest.mock('@bpmn-io/properties-panel', () => ({
  CheckboxEntry: jest.fn((props: unknown) => props),
  DescriptionEntry: jest.fn(
    (props: unknown) => props
  ),
  Group: jest.fn(),
  SelectEntry: jest.fn(
    (props: unknown) => props
  ),
  TextFieldEntry: jest.fn(
    (props: unknown) => props
  )
}));

jest.mock('bpmn-js-properties-panel', () => ({
  useService: jest.fn()
}));

const {
  useService
} = jest.requireMock(
  'bpmn-js-properties-panel'
) as {
  useService: jest.Mock;
};

const EMPTY_RESULT: ModelFeelAnalysisResult = {
  valid: true,
  analyses: [],
  variables: [],
  diagnostics: [],
  conflicts: []
};

describe('modelFeelPropertiesProvider', () => {
  test('connects the process-input checkbox to its setter', () => {
    const setProcessInput = jest.fn();
    const variable = {
      name: 'Num',
    } as Parameters<typeof VariableProcessInputEntry>[0]['variable'];
    VariableProcessInputEntry({
      element: {},
      id: 'num-process-input',
      variable,
      processInput: true,
      setProcessInput,
    });
    const props = jest.mocked(CheckboxEntry).mock.calls.at(-1)![0];
    expect(props.getValue()).toBe(true);
    props.setValue(false);
    expect(setProcessInput).toHaveBeenCalledWith(false);
  });

  function createProvider(
    result: ModelFeelAnalysisResult = EMPTY_RESULT,
    initialValues: Record<string, string> = {}
  ) {
    const propertiesPanel = {
      registerProvider: jest.fn()
    };

    let stateListener:
      | ((
        result: ModelFeelAnalysisResult
      ) => void)
      | undefined;

    let initialValuesListener:
      | ((
        initialValues: Record<string, string>
      ) => void)
      | undefined;

    const unsubscribe = jest.fn();
    const unsubscribeInitialValues = jest.fn();

    const analysisState = {
      getProcessInputs: jest.fn(() => [] as string[]),
      setProcessInput: jest.fn(),
      subscribeProcessInputs: jest.fn(() => jest.fn()),
      getResult: () => result,
      getUserTypes: jest.fn(() => ({})),
      setUserType: jest.fn(),
      getInitialValues: jest.fn(() => ({
        ...initialValues
      })),
      setInitialValue: jest.fn(),

      subscribeInitialValues: jest.fn(
        (
          listener: (
            initialValues: Record<string, string>
          ) => void
        ) => {
          initialValuesListener = listener;

          return unsubscribeInitialValues;
        }
      ),

      subscribe: jest.fn(
        (
          listener: (
            result: ModelFeelAnalysisResult
          ) => void
        ) => {
          stateListener = listener;

          return unsubscribe;
        }
      )
    };

    const eventBus = {
      fire: jest.fn(),
      on: jest.fn()
    };

    const translate = (text: string): string => text;

    const provider =
      new ModelFeelPropertiesProvider(
        propertiesPanel,
        analysisState,
        eventBus,
        translate
      );

    return {
      propertiesPanel,
      analysisState,
      eventBus,
      provider,
      stateListener,
      unsubscribe,
      initialValuesListener,
      unsubscribeInitialValues
    };
  }

  test('registers after the built-in provider', () => {
    const {
      propertiesPanel,
      provider
    } = createProvider();

    expect(
      propertiesPanel.registerProvider
    ).toHaveBeenCalledWith(500, provider);
  });

  test('adds an empty Variables group', () => {
    const { provider } = createProvider();

    const existingGroups = [
      {
        id: 'general'
      }
    ];

    const groups = provider.getGroups({})(
      existingGroups
    );

    expect(groups[0]).toBe(existingGroups[0]);

    expect(groups[1]).toEqual(
      expect.objectContaining({
        id: 'model-feel-variables',
        label: 'Variables',
        shouldOpen: true,
        entries: []
      })
    );
  });

  test('adds a default-open Errors group with collected errors', () => {
    const source = {
      origin: 'bpmn-gateway-condition' as const,
      elementId: 'TextAnnotation_1',
      gatewayId: 'Gateway_1',
      associationId: 'Association_1',
      flowId: 'Flow_1',
      targetId: 'Task_1',
      expression: 'date()',
      feelKind: 'expression' as const,
      expectedType: 'boolean' as const
    };

    const result: ModelFeelAnalysisResult = {
      valid: false,
      analyses: [],
      variables: [],
      diagnostics: [
        {
          source,
          diagnostic: {
            code: 'unsupported-function',
            message:
              'Function "date" is not supported.',
            from: 0,
            to: 6
          }
        }
      ],
      conflicts: []
    };

    const { provider } = createProvider(result);

    const groups = provider.getGroups({})([]);

    expect(groups[1]).toEqual(
      expect.objectContaining({
        id: 'model-feel-errors',
        label: 'Errors',
        shouldOpen: true,
        entries: [
          expect.objectContaining({
            id: 'model-feel-error-0',
            component: ModelFeelErrorEntry,
            error: {
              kind: 'feel',
              code: 'unsupported-function',
              message:
                'Function "date" is not supported.',
              source,
              from: 0,
              to: 6
            }
          })
        ]
      })
    );
  });

  test('renders errors with source context', () => {
    const element = {
      id: 'Task_1'
    };

    ModelFeelErrorEntry({
      element,
      id: 'model-feel-error-0',
      error: {
        kind: 'feel',
        code: 'unsupported-function',
        message:
          'Function "date" is not supported.',
        source: {
          origin: 'bpmn-gateway-condition',
          elementId: 'TextAnnotation_1',
          gatewayId: 'Gateway_1',
          associationId: 'Association_1',
          flowId: 'Flow_1',
          targetId: 'Task_1',
          expression: 'date()',
          feelKind: 'expression',
          expectedType: 'boolean'
        },
        from: 0,
        to: 6
      }
    });

    const descriptionEntry =
      jest.mocked(DescriptionEntry);

    expect(
      descriptionEntry
    ).toHaveBeenCalledWith({
      element,
      forId: 'model-feel-error-0',
      value:
        'BPMN gateway "Gateway_1", ' +
        'flow "Flow_1": ' +
        'Function "date" is not supported.'
    });
  });

  test('creates type and initial-value entries for each variable', () => {
    const result: ModelFeelAnalysisResult = {
      valid: true,
      analyses: [],
      variables: [
        {
          name: 'age',
          possibleTypes: ['number'],
          resolvedType: 'number',
          typeOrigin: 'inferred',
          status: 'resolved'
        }
      ],
      diagnostics: [],
      conflicts: []
    };

    const {
      provider,
      analysisState
    } = createProvider(result, {
      age: '18'
    });

    const groups = provider.getGroups({})([]);
    const variablesGroup = groups[0];

    expect(variablesGroup.entries).toEqual([
      expect.objectContaining({
        id: 'model-feel-variable-age-heading',
        variable: result.variables[0],
        component: VariableHeadingEntry,
      }),
      expect.objectContaining({
        id: 'model-feel-variable-age',
        variable: result.variables[0],
        component: VariableTypeEntry
      }),

      expect.objectContaining({
        id:
          'model-feel-variable-age-initial-value',
        variable: result.variables[0],
        component: VariableInitialValueEntry,
        initialValue: '18',
        setInitialValue: expect.any(Function)
      }),
      expect.objectContaining({
        component: VariableProcessInputEntry,
        processInput: false,
      })
    ]);

    const initialValueEntry =
      variablesGroup.entries?.[2] as unknown as {
        setInitialValue: (
          value: string | undefined
        ) => void;
      };

    initialValueEntry.setInitialValue('21');

    expect(
      analysisState.setInitialValue
    ).toHaveBeenCalledWith('age', '21');
  });

  test('refreshes the properties panel when analysis changes', () => {
    const {
      eventBus,
      stateListener
    } = createProvider();

    expect(stateListener).toBeDefined();

    stateListener?.(EMPTY_RESULT);

    expect(eventBus.fire).toHaveBeenCalledWith(
      'propertiesPanel.providersChanged'
    );
  });

  test('refreshes the properties panel when initial values change', () => {
    const {
      eventBus,
      initialValuesListener
    } = createProvider();

    expect(initialValuesListener).toBeDefined();

    initialValuesListener?.({
      age: '18'
    });

    expect(eventBus.fire).toHaveBeenCalledWith(
      'propertiesPanel.providersChanged'
    );
  });

  test('lets the user select an unresolved variable type', () => {
    const setUserType = jest.fn();

    VariableTypeEntry({
      element: {
        id: 'Task_1'
      },
      id: 'model-feel-variable-category',
      variable: {
        name: 'category',
        possibleTypes: [
          'string',
          'number'
        ],
        status: 'unresolved'
      },
      userType: undefined,
      setUserType
    });

    const selectEntry =
      jest.mocked(SelectEntry);

    const props =
      selectEntry.mock.calls[0][0];

    expect(props.disabled).toBe(false);
    expect(props.getValue()).toBe('');

    expect(props.getOptions()).toEqual([
      {
        value: '',
        label: 'Select a type'
      },
      {
        value: 'string',
        label: 'string'
      },
      {
        value: 'number',
        label: 'number'
      }
    ]);

    props.setValue('string');

    expect(setUserType).toHaveBeenCalledWith(
      'string'
    );

    props.setValue('');

    expect(setUserType).toHaveBeenCalledWith(
      undefined
    );
  });
  
  test('lets the user enter an initial value', () => {
    const debounceInput = jest.fn(
      (callback: unknown) => callback
    );

    useService.mockReturnValue(debounceInput);

    const setInitialValue = jest.fn();

    VariableInitialValueEntry({
      element: {
        id: 'Task_1'
      },

      id: 'model-feel-variable-age-initial-value',

      variable: {
        name: 'age',
        possibleTypes: ['number'],
        resolvedType: 'number',
        typeOrigin: 'inferred',
        status: 'resolved'
      },

      initialValue: '18',
      setInitialValue
    });

    const textFieldEntry =
      jest.mocked(TextFieldEntry);

    const props =
      textFieldEntry.mock.calls[0][0];

    expect(props.label).toBe(
      'Initial value'
    );

    expect(props.getValue()).toBe('18');
    expect(props.disabled).toBe(false);

    expect(useService).toHaveBeenCalledWith(
      'debounceInput'
    );

    expect(props).toEqual(
      expect.objectContaining({
        debounce: debounceInput,
        validate: expect.any(Function)
      })
    );

    const validate =
      (
        props as unknown as {
          validate: (
            value: string | undefined
          ) => string | undefined;
        }
      ).validate;

    expect(validate('21')).toBeUndefined();

    expect(
      validate('not-a-number')
    ).toBe(
      '"age" must have a valid numeric initial value.'
    );

    expect(
      validate(undefined)
    ).toBe(
      'Enter an initial value for "age".'
    );

    props.setValue('21');

    expect(setInitialValue).toHaveBeenCalledWith(
      '21'
    );
  });
});
