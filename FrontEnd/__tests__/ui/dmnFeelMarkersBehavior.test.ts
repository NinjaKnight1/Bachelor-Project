import {
  DmnFeelMarkersBehavior,
  default as dmnFeelMarkersModule
} from '../../dmn/dmnFeelMarkersBehavior';

import {
  syncDmnFeelMarkers
} from '../../dmn/dmnFeelMarkers';

import {
  collectModelFeelErrors,
  type ModelFeelError
} from '../../modelFeelErrors';

import type {
  ModelFeelAnalysisResult
} from '../../modelFeelAnalysis';

jest.mock('../../dmn/dmnFeelMarkers');
jest.mock('../../modelFeelErrors');

describe('DMN FEEL marker behavior', () => {
  test('synchronizes markers with the table and state', () => {
    const container =
      document.createElement('div');

    const result: ModelFeelAnalysisResult = {
      valid: true,
      analyses: [],
      variables: [],
      diagnostics: [],
      conflicts: []
    };

    const initialValues = {
      age: '18'
    };

    const eventListeners =
      new Map<string, () => void>();

    const eventBus = {
      on: jest.fn(
        (
          event: string,
          listener: () => void
        ) => {
          eventListeners.set(event, listener);
        }
      )
    };

    const renderer = {
      getContainer: jest.fn(() => container)
    };

    let resultListener:
      ((value: ModelFeelAnalysisResult) => void) |
      undefined;

    let initialValuesListener:
      ((values: Record<string, string>) => void) |
      undefined;

    const unsubscribeResult = jest.fn();
    const unsubscribeInitialValues = jest.fn();

    const state = {
      getResult: jest.fn(() => result),

      getInitialValues:
        jest.fn(() => initialValues),

      subscribe: jest.fn(
        (
          listener:
            (value: ModelFeelAnalysisResult) => void
        ) => {
          resultListener = listener;
          return unsubscribeResult;
        }
      ),

      subscribeInitialValues: jest.fn(
        (
          listener:
            (
              values: Record<string, string>
            ) => void
        ) => {
          initialValuesListener = listener;
          return unsubscribeInitialValues;
        }
      )
    };

    const errors: ModelFeelError[] = [];

    jest.mocked(
      collectModelFeelErrors
    ).mockReturnValue(errors);

    new DmnFeelMarkersBehavior(
      eventBus,
      renderer,
      state
    );

    eventListeners.get('elements.changed')?.();

    expect(collectModelFeelErrors)
      .toHaveBeenCalledWith(
        result,
        initialValues
      );

    expect(syncDmnFeelMarkers)
      .toHaveBeenCalledWith(
        container,
        errors
      );

    resultListener?.(result);
    initialValuesListener?.(initialValues);

    expect(syncDmnFeelMarkers)
      .toHaveBeenCalledTimes(3);

    eventListeners.get('table.destroy')?.();

    expect(unsubscribeResult)
      .toHaveBeenCalledTimes(1);

    expect(unsubscribeInitialValues)
      .toHaveBeenCalledTimes(1);
  });

  test('exports a dmn-js decision-table module', () => {
    expect(dmnFeelMarkersModule).toEqual({
      __init__: [
        'dmnFeelMarkersBehavior'
      ],
      dmnFeelMarkersBehavior: [
        'type',
        DmnFeelMarkersBehavior
      ]
    });
  });
});
