import { readFileSync } from 'fs';
import { join } from 'path';
import { guardsFromDmnmodeler } from '../translationOfFeel'

import BpmnModeler from 'bpmn-js/dist/bpmn-modeler.development.js';
import DmnModeler from 'dmn-js/dist/dmn-modeler.development.js';

function readFromFile(fileName: string) {
  return readFileSync(join(__dirname, 'testDiagrams', fileName), 'utf-8');
}

describe('DMN', () => {
  describe('Dish Decision - decision table', () => {
    const xml = readFromFile('DishDecisionTable.dmn');
    const bpmnModeler = new BpmnModeler({
      container: document.createElement('div')
    });

    const dmnModeler = new DmnModeler({
      container: document.createElement('div')
    });

    /* ④  importXML is async – wait for it before you run assertions */
    beforeAll(async () => {
      await dmnModeler.importXML(xml);
    });

    it('handles a range [1..5)', () => {
      const output = guardsFromDmnmodeler(dmnModeler);
      expect(output).toBe('');
    });

  });

});
