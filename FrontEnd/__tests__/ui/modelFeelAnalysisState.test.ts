import {
  ModelFeelAnalysisState
} from '../../modelFeelAnalysisState';

import type {
  ModelFeelAnalysisResult
} from '../../modelFeelAnalysis';

describe('modelFeelAnalysisState', () => {
  test('starts with an empty valid result', () => {
    const state = new ModelFeelAnalysisState();

    expect(state.getResult()).toEqual({
      valid: true,
      analyses: [],
      variables: [],
      diagnostics: [],
      conflicts: []
    });
  });

  test('stores and publishes the latest result', () => {
    const state = new ModelFeelAnalysisState();

    const listener = jest.fn();

    const unsubscribe =
      state.subscribe(listener);

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

    state.setResult(result);

    expect(state.getResult()).toBe(result);
    expect(listener).toHaveBeenCalledWith(result);

    unsubscribe();

    state.setResult(result);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('stores and publishes user-selected variable types', () => {
    const state = new ModelFeelAnalysisState();
    const listener = jest.fn();

    const unsubscribe =
      state.subscribeUserTypes(listener);

    state.setUserType('customerCategory', 'string');

    expect(state.getUserTypes()).toEqual({
      customerCategory: 'string'
    });

    expect(listener).toHaveBeenLastCalledWith({
      customerCategory: 'string'
    });

    state.setUserType('amount', 'number');

    expect(state.getUserTypes()).toEqual({
      customerCategory: 'string',
      amount: 'number'
    });

    state.setUserType(
      'customerCategory',
      undefined
    );

    expect(state.getUserTypes()).toEqual({
      amount: 'number'
    });

    unsubscribe();

    state.setUserType('approved', 'boolean');

    expect(listener).toHaveBeenCalledTimes(3);
  });
  test('stores and publishes variable initial values', () => {
    const state = new ModelFeelAnalysisState();
    const listener = jest.fn();

    const unsubscribe =
      state.subscribeInitialValues(listener);

    state.setInitialValue('age', '18');

    expect(state.getInitialValues()).toEqual({
      age: '18'
    });

    expect(listener).toHaveBeenLastCalledWith({
      age: '18'
    });

    state.setInitialValue('approved', 'true');

    expect(state.getInitialValues()).toEqual({
      age: '18',
      approved: 'true'
    });

    state.setInitialValue(
      'age',
      undefined
    );

    expect(state.getInitialValues()).toEqual({
      approved: 'true'
    });

    unsubscribe();

    state.setInitialValue('category', 'premium');

    expect(listener).toHaveBeenCalledTimes(3);
  });
});