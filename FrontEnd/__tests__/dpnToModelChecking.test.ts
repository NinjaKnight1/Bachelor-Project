import { DPN } from '../bpmnToDpnConversion/dpn';
import { dpnToModelChecking } from '../bpmnToDpnConversion/dpnToModelChecking';
import { VariableTypes } from '../translationOfADA';

describe('DPN model-checking export', () => {
  it('creates ADA-style marking states and carries data updates forward', () => {
    const dpn = new DPN();
    dpn.variables = [
      { name: 'approved', type: VariableTypes.boolean, value: 'false' },
      { name: 'amount', type: VariableTypes.number, value: '42' },
      { name: 'weather', type: VariableTypes.string, value: 'Cold' },
    ];
    dpn.addPlace('afterStart');
    dpn.addTransition('start', 'Start');
    dpn.addTransition('decide', 'Decide', null, "(approved' == true)");
    dpn.addTransition('describe', 'Describe', null, '(weather == "Cold")');
    dpn.addArc('source', 'start');
    dpn.addArc('start', 'afterStart');
    dpn.addArc('afterStart', 'decide');
    dpn.addArc('decide', 'sink');
    dpn.addArc('afterStart', 'describe');
    dpn.addArc('describe', 'sink');

    expect(dpnToModelChecking(dpn)).toEqual({
      name: 'BPMN/DMN model',
      states: [
        { id: 0, name: 'source', initial: true, final: false },
        { id: 1, name: 'afterStart', initial: false, final: false },
        { id: 2, name: 'sink', initial: false, final: true },
      ],
      transitions: [
        { source: 0, target: 1, name: 'Start', written: [] },
        { source: 1, target: 2, name: 'Decide', guard: "(approved' == true)", written: ['approved'] },
        { source: 1, target: 2, name: 'Describe', guard: '(weather == "Cold")', written: [] },
      ],
      variables: [
        { name: 'approved', initial: false, type: 'bool' },
        { name: 'amount', initial: 42, type: 'rat' },
        { name: 'weather', initial: 0, type: 'int' },
      ],
      property: 'F sink',
    });
  });
});
