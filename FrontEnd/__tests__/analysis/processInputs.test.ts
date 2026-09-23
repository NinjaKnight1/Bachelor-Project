import { ModelFeelAnalysisState } from '../../modelFeelAnalysisState';

describe('process input configuration', () => {
  it('stores selections independently and returns a snapshot', () => {
    const state = new ModelFeelAnalysisState();
    state.setInitialValue('Num', '42');
    state.setProcessInput('Num', true);
    const snapshot = state.getProcessInputs();
    snapshot.length = 0;
    expect(state.getProcessInputs()).toEqual(['Num']);
    state.setProcessInput('Num', false);
    expect(state.getProcessInputs()).toEqual([]);
    expect(state.getInitialValues()).toEqual({ Num: '42' });
  });

  it('notifies subscribers and clears selections on request', () => {
    const state = new ModelFeelAnalysisState();
    const listener = jest.fn();
    const unsubscribe = state.subscribeProcessInputs(listener);
    state.setProcessInput('Num', true);
    state.setProcessInput('Num', true);
    expect(listener).toHaveBeenCalledTimes(1);
    state.clearProcessInputs();
    expect(state.getProcessInputs()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    state.setProcessInput('Weather', true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
