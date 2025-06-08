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

    it('handles the translation of a decision table', () => {
      const output = guardsFromDmnmodeler(dmnModeler);
      const expected: ReturnType<typeof guardsFromDmnmodeler> = [
    [
      {
        tableId: 'dish-decision',
        hitPolicy: 'UNIQUE',
        inputs: [{ expression: 'season' }, { expression: 'guestCount' }],
        outputs: [{ expression: 'desiredDish' }],
        rules: [
          { row: 0, pre: '(and (not (= season "Winter")) (<= guestCount 8))', post: '(= desiredDish "Spareribs")' },
          { row: 1, pre: '(and (= season "Winter") (> guestCount 8))', post: '(= desiredDish "Pasta")' },
          { row: 2, pre: '(and (= season "Summer") (> guestCount 10))', post: '(= desiredDish "Light salad")' },
          { row: 3, pre: '(and (= season "Summer") (<= guestCount 10))', post: '(= desiredDish "Beans salad")' },
          { row: 4, pre: '(and (= season "Spring") (< guestCount 10))', post: '(= desiredDish "Stew")' },
          { row: 5, pre: '(and (= season "Spring") (>= guestCount 10))', post: '(= desiredDish "Steak")' }
        ]
      }
    ],
    new Set(['season', 'guestCount', 'desiredDish'])
  ];
      expect(output).toEqual(expected);
    });

  });

});
