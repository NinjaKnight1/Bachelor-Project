import type {
  ModelFeelAnalysisResult
} from './modelFeelAnalysis';

import type {
  SupportedVariableType
} from './supportedSFeel';

type ModelFeelAnalysisListener = (
  result: ModelFeelAnalysisResult
) => void;

type ModelFeelUserTypes = Record<
  string,
  SupportedVariableType
>;

type ModelFeelUserTypesListener = (
  userTypes: ModelFeelUserTypes
) => void;

type ModelFeelInitialValues = Record<
  string,
  string
>;

type ModelFeelInitialValuesListener = (
  initialValues: ModelFeelInitialValues
) => void;

const EMPTY_RESULT: ModelFeelAnalysisResult = {
  valid: true,
  analyses: [],
  variables: [],
  diagnostics: [],
  conflicts: []
};

export class ModelFeelAnalysisState {
  private result: ModelFeelAnalysisResult =
    EMPTY_RESULT;

  private userTypes: ModelFeelUserTypes = {};

  private initialValues: ModelFeelInitialValues = {};

  private readonly initialValuesListeners = new Set<ModelFeelInitialValuesListener>();

  private readonly listeners = new Set<ModelFeelAnalysisListener>();

  private readonly userTypesListeners = new Set<ModelFeelUserTypesListener>();

  getResult(): ModelFeelAnalysisResult {
    return this.result;
  }

  setResult(
    result: ModelFeelAnalysisResult
  ): void {
    this.result = result;

    this.listeners.forEach(listener => {
      listener(result);
    });
  }

  subscribe(
    listener: ModelFeelAnalysisListener
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getUserTypes(): ModelFeelUserTypes {
    return {
      ...this.userTypes
    };
  }

  setUserType(
    variableName: string,
    type: SupportedVariableType | undefined
  ): void {
    const userTypes = {
      ...this.userTypes
    };

    if (type === undefined) {
      delete userTypes[variableName];
    } else {
      userTypes[variableName] = type;
    }

    this.userTypes = userTypes;

    this.userTypesListeners.forEach(listener => {
      listener(this.getUserTypes());
    });
  }

  subscribeUserTypes(
    listener: ModelFeelUserTypesListener
  ): () => void {
    this.userTypesListeners.add(listener);

    return () => {
      this.userTypesListeners.delete(listener);
    };
  }


  getInitialValues(): ModelFeelInitialValues {
    return {
      ...this.initialValues
    };
  }

  setInitialValue(
    variableName: string,
    value: string | undefined
  ): void {
    const initialValues = {
      ...this.initialValues
    };

    if (value === undefined) {
      delete initialValues[variableName];
    } else {
      initialValues[variableName] = value;
    }

    this.initialValues = initialValues;

    this.initialValuesListeners.forEach(
      listener => {
        listener(this.getInitialValues());
      }
    );
  }

  subscribeInitialValues(
    listener: ModelFeelInitialValuesListener
  ): () => void {
    this.initialValuesListeners.add(listener);

    return () => {
      this.initialValuesListeners.delete(
        listener
      );
    };
  }

}

export const modelFeelAnalysisState =
  new ModelFeelAnalysisState();