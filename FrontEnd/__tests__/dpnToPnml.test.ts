import { DPN } from '../bpmnToDpnConversion/dpn';
import { dpnToPnmlFile } from '../bpmnToDpnConversion/dpnToPnml';
import { VariableTypes } from '../translationOfADA';

describe('PNML variable writes', () => {
  it('exports explicit writes only on the transition that assigns them', () => {
    const dpn = new DPN();
    dpn.variables = [
      { name: 'Num', type: VariableTypes.number, value: '' },
    ];

    const inputs = ['Num', 'Num'];
    dpn.addTransition('start', 'Start', null, null, inputs);
    inputs.length = 0;

    dpn.addTransition('read', 'Read', null, '(Num > 0)');

    const xml = new DOMParser().parseFromString(
      dpnToPnmlFile(dpn),
      'application/xml',
    );

    const transitions = Array.from(
      xml.getElementsByTagName('transition'),
    );

    const writes = (id: string) =>
      Array.from(
        transitions.find(t => t.getAttribute('id') === id)!
          .getElementsByTagName('writeVariable'),
      ).map(element => element.textContent);

    expect(writes('start')).toEqual(['Num']);
    expect(writes('read')).toEqual([]);
  });
});
