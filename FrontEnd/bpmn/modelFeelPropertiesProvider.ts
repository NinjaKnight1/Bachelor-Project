import {
  DescriptionEntry,
  Group,
  SelectEntry,
  TextFieldEntry,
  type DebounceInput,
  type SelectEntryOption
} from '@bpmn-io/properties-panel';

import {
  useService
} from 'bpmn-js-properties-panel';

import type {
  ModelFeelAnalysisResult,
  ResolvedModelFeelVariable
} from '../modelFeelAnalysis';

import {
  modelFeelAnalysisState
} from '../modelFeelAnalysisState';

import {
  validateModelFeelInitialValue
} from '../initialValueValidation';

import {
  collectModelFeelErrors,
  formatModelFeelError,
  type ModelFeelError
} from '../modelFeelErrors';

import type {
  SupportedVariableType
} from '../supportedSFeel';

const LOW_PRIORITY = 500;

interface PropertiesPanelLike {
  registerProvider(
    priority: number,
    provider: ModelFeelPropertiesProvider
  ): void;
}

interface ModelFeelAnalysisStateLike {
  getResult(): ModelFeelAnalysisResult;

  subscribe(
    listener: (
      result: ModelFeelAnalysisResult
    ) => void
  ): () => void;

  getUserTypes(): Record<string, SupportedVariableType>;

  setUserType(
    variableName: string,
    type: SupportedVariableType | undefined
  ): void;

  getInitialValues(): Record<string, string>;

  setInitialValue(
    variableName: string,
    value: string | undefined
  ): void;

  subscribeInitialValues(
    listener: (
      initialValues: Record<string, string>
    ) => void
  ): () => void;

}

interface EventBusLike {
  fire(
    event: string,
    context?: unknown
  ): void;

  on(
    event: string,
    listener: () => void
  ): void;
}

interface VariableTypePropertiesPanelEntry {
  id: string;

  component: (
    props: VariableTypeEntryProps
  ) => unknown;

  variable: ResolvedModelFeelVariable;
  userType?: SupportedVariableType;

  setUserType: (
    type: SupportedVariableType | undefined
  ) => void;
}

interface VariableInitialValuePropertiesPanelEntry {
  id: string;

  component: (
    props: VariableInitialValueEntryProps
  ) => unknown;

  variable: ResolvedModelFeelVariable;
  initialValue?: string;

  setInitialValue: (
    value: string | undefined
  ) => void;
}

interface ModelFeelErrorEntryProps {
  element: unknown;
  id: string;
  error: ModelFeelError;
}

interface ModelFeelErrorPropertiesPanelEntry {
  id: string;

  component: (
    props: ModelFeelErrorEntryProps
  ) => unknown;

  error: ModelFeelError;
}

type PropertiesPanelEntry =
  | VariableTypePropertiesPanelEntry
  | VariableInitialValuePropertiesPanelEntry
  | ModelFeelErrorPropertiesPanelEntry;

interface PropertiesPanelGroup {
  id: string;
  label?: string;
  component?: unknown;
  shouldOpen?: boolean;
  entries?: PropertiesPanelEntry[];
}

interface VariableTypeEntryProps {
  element: unknown;
  id: string;
  variable: ResolvedModelFeelVariable;
  userType?: SupportedVariableType;

  setUserType: (
    type: SupportedVariableType | undefined
  ) => void;
}

interface VariableInitialValueEntryProps {
  element: unknown;
  id: string;
  variable: ResolvedModelFeelVariable;
  initialValue?: string;

  setInitialValue: (
    value: string | undefined
  ) => void;
}

type Translate = (text: string) => string;

export function VariableTypeEntry({
  element,
  id,
  variable,
  userType,
  setUserType
}: VariableTypeEntryProps): unknown {
  const isEditable =
    variable.typeOrigin !== 'declared' &&
    variable.typeOrigin !== 'inferred';

  const optionTypes = Array.from(
    new Set([
      ...(
        variable.resolvedType
          ? [variable.resolvedType]
          : []
      ),
      ...variable.possibleTypes
    ])
  );

  const options: SelectEntryOption[] =
    optionTypes.map(type => ({
      value: type,
      label: type
    }));

  if (isEditable) {
    options.unshift({
      value: '',
      label:
        variable.status === 'conflict'
          ? 'Conflicting types'
          : 'Select a type'
    });
  }

  return SelectEntry({
    element,
    id,
    label: variable.name,

    getValue: () =>
      userType ??
      variable.resolvedType ??
      '',

    setValue: value => {
      if (
        value === 'string' ||
        value === 'number' ||
        value === 'boolean'
      ) {
        setUserType(value);
      } else {
        setUserType(undefined);
      }
    },

    getOptions: () => options,
    disabled: !isEditable
  });
}

export function VariableInitialValueEntry({
  element,
  id,
  variable,
  initialValue,
  setInitialValue
}: VariableInitialValueEntryProps): unknown {
  const debounce =
    useService<DebounceInput>('debounceInput');

  return TextFieldEntry({
    element,
    id,
    label: `${variable.name} initial value`,
    debounce,

    getValue: () => initialValue ?? '',

    setValue: value => {
      setInitialValue(value);
    },

    validate: value =>
      validateModelFeelInitialValue(
        variable,
        value
      )?.message,

    disabled:
      variable.status !== 'resolved' ||
      variable.resolvedType === undefined
  });
}

export function ModelFeelErrorEntry({
  element,
  id,
  error
}: ModelFeelErrorEntryProps): unknown {
  return DescriptionEntry({
    element,
    forId: id,
    value: formatModelFeelError(error)
  });
}

export class ModelFeelPropertiesProvider {
  static $inject = [
    'propertiesPanel',
    'modelFeelAnalysisState',
    'eventBus',
    'translate'
  ];

  private readonly analysisState:
    ModelFeelAnalysisStateLike;

  private readonly translate: Translate;

  constructor(
    propertiesPanel: PropertiesPanelLike,
    analysisState: ModelFeelAnalysisStateLike,
    eventBus: EventBusLike,
    translate: Translate
  ) {
    this.analysisState = analysisState;
    this.translate = translate;

    propertiesPanel.registerProvider(
      LOW_PRIORITY,
      this
    );

    const unsubscribe =
      analysisState.subscribe(() => {
        eventBus.fire(
          'propertiesPanel.providersChanged'
        );
      });

    const unsubscribeInitialValues =
      analysisState.subscribeInitialValues(() => {
        eventBus.fire(
          'propertiesPanel.providersChanged'
        );
      });

    eventBus.on(
      'diagram.destroy',
      unsubscribe
    );

    eventBus.on(
      'diagram.destroy',
      unsubscribeInitialValues
    );
  }

  getGroups(
    _element: unknown
  ): (
    groups: PropertiesPanelGroup[]
  ) => PropertiesPanelGroup[] {
    return groups => {
      const analysisResult =
        this.analysisState.getResult();

      const userTypes =
        this.analysisState.getUserTypes();

      const initialValues =
        this.analysisState.getInitialValues();

      const entries =
        analysisResult
          .variables
          .flatMap(
            (variable): PropertiesPanelEntry[] => [
              {
                id:
                  'model-feel-variable-' +
                  encodeURIComponent(variable.name),

                component: VariableTypeEntry,
                variable,

                userType:
                  userTypes[variable.name],

                setUserType: type => {
                  this.analysisState.setUserType(
                    variable.name,
                    type
                  );
                }
              },
              {
                id:
                  'model-feel-variable-' +
                  encodeURIComponent(variable.name) +
                  '-initial-value',

                component: VariableInitialValueEntry,
                variable,

                initialValue:
                  initialValues[variable.name],

                setInitialValue: value => {
                  this.analysisState.setInitialValue(
                    variable.name,
                    value
                  );
                }
              }
            ]
          );

      const errors = collectModelFeelErrors(
        analysisResult,
        initialValues
      );

      const errorEntries:
        ModelFeelErrorPropertiesPanelEntry[] =
          errors.map((error, index) => ({
            id: `model-feel-error-${index}`,
            component: ModelFeelErrorEntry,
            error
          }));

      return [
        ...groups,
        {
          id: 'model-feel-variables',
          label: this.translate('Variables'),
          component: Group,
          shouldOpen: true,
          entries
        },
        {
          id: 'model-feel-errors',
          label: this.translate('Errors'),
          component: Group,
          shouldOpen: true,
          entries: errorEntries
        }
      ];
    };
  }
}

export default {
  __init__: [
    'modelFeelPropertiesProvider'
  ],

  modelFeelAnalysisState: [
    'value',
    modelFeelAnalysisState
  ],

  modelFeelPropertiesProvider: [
    'type',
    ModelFeelPropertiesProvider
  ]
};
