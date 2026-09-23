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
        { source: 1, target: 2, name: 'Describe', guard: '(weather == string_Cold_0)', written: [] },
      ],
      variables: [
        { name: 'approved', initial: false, type: 'bool' },
        { name: 'amount', initial: 42, type: 'rat' },
        { name: 'weather', initial: 'string_Cold_0', type: 'string' },
      ],
      property: 'F sink',
      functions: [
        { name: 'string_Cold_0', domain: [], range: 'string' },
      ],
    });
  });
});

describe('ADA symbolic strings', () => {
  function createModel(initial: string, guard?: string): DPN {
    const dpn = new DPN();

    dpn.variables = [
      { name: 'Weather', type: VariableTypes.string, value: initial },
    ];

    dpn.addTransition('change', 'Change', null, guard ?? null);
    dpn.addArc('source', 'change');
    dpn.addArc('change', 'sink');

    return dpn;
  }

  it('preserves different initial strings absent from guards', () => {
    const dpn = new DPN();

    dpn.variables = [
      { name: 'Clothing', type: VariableTypes.string, value: 'stra' },
      { name: 'Confirm', type: VariableTypes.boolean, value: 'true' },
      { name: 'Num', type: VariableTypes.number, value: '2' },
      { name: 'Weather', type: VariableTypes.string, value: 'stj' },
    ];

    const model = dpnToModelChecking(dpn);

    expect(model.variables).toEqual([
      { name: 'Clothing', type: 'string', initial: 'string_stra_0' },
      { name: 'Confirm', type: 'bool', initial: true },
      { name: 'Num', type: 'rat', initial: 2 },
      { name: 'Weather', type: 'string', initial: 'string_stj_1' },
    ]);

    expect(model.functions).toEqual([
      { name: 'string_stra_0', domain: [], range: 'string' },
      { name: 'string_stj_1', domain: [], range: 'string' },
    ]);

    expect(model.facts).toBe(
      'distinct(string_stra_0, string_stj_1)',
    );
  });

  it('shares constants across initial values, updates and properties', () => {
    const guard = `(Weather == "stj") && (Weather' == "Sunny")`;
    const dpn = createModel('stj', guard);

    const model = dpnToModelChecking(
      dpn,
      'F ((Weather == "Sunny") || (Weather == "Rainy"))',
    );

    expect(model.transitions[0].guard).toBe(
      "(Weather == string_stj_0) && (Weather' == string_Sunny_1)",
    );

    expect(model.transitions[0].written).toEqual(['Weather']);

    expect(model.property).toBe(
      'F ((Weather == string_Sunny_1) || (Weather == string_Rainy_2))',
    );

    expect(model.functions).toEqual([
      { name: 'string_stj_0', domain: [], range: 'string' },
      { name: 'string_Sunny_1', domain: [], range: 'string' },
      { name: 'string_Rainy_2', domain: [], range: 'string' },
    ]);

    expect(model.facts).toBe(
      'distinct(string_stj_0, string_Sunny_1, string_Rainy_2)',
    );

    expect(dpn.transitions.get('change')?.guard).toBe(guard);
    expect(dpn.variables[0].value).toBe('stj');
  });

  it('reuses escaped strings without trimming their contents', () => {
    const value = ' He said "hello" \\ goodbye ';
    const literal = JSON.stringify(value);
    const dpn = createModel(value, `Weather == ${literal}`);

    const model = dpnToModelChecking(
      dpn,
      `F (Weather == ${literal})`,
    );

    expect(model.transitions[0].guard).toBe(
      'Weather == string_He_said_hello_goodbye_0',
    );
    expect(model.property).toBe('F (Weather == string_He_said_hello_goodbye_0)');
    expect(model.functions).toHaveLength(1);
    expect(model).not.toHaveProperty('facts');
  });

  it('creates readable names without merging different text values', () => {
    const dpn = createModel(
      'hej',
      '(Weather == "T-Shirt") || (Weather == "T Shirt")',
    );

    const model = dpnToModelChecking(dpn, 'F (Weather == "hej")');

    expect(model.variables[0].initial).toBe('string_hej_0');

    expect(model.transitions[0].guard).toBe(
      '(Weather == string_T_Shirt_1) || (Weather == string_T_Shirt_2)',
    );

    expect(model.property).toBe('F (Weather == string_hej_0)');

    expect(model.functions).toEqual([
      { name: 'string_hej_0', domain: [], range: 'string' },
      { name: 'string_T_Shirt_1', domain: [], range: 'string' },
      { name: 'string_T_Shirt_2', domain: [], range: 'string' },
    ]);

    expect(model.facts).toBe(
      'distinct(string_hej_0, string_T_Shirt_1, string_T_Shirt_2)',
    );
  });

  it('omits string declarations when there are no string values', () => {
    const model = dpnToModelChecking(new DPN());

    expect(model.property).toBe('F sink');
    expect(model).not.toHaveProperty('functions');
    expect(model).not.toHaveProperty('facts');
  });

  it.each(['string', 'string_Sunny_0'])(
    'avoids collisions with variable %s',
    name => {
      const dpn = new DPN();

      dpn.variables = [
        { name, type: VariableTypes.string, value: 'Sunny' },
      ];

      const model = dpnToModelChecking(
        dpn,
        `F (${name} == "Sunny")`,
      );

      expect(model.variables[0].initial).toBe('_string_Sunny_0');
      expect(model.property).toBe(`F (${name} == _string_Sunny_0)`);
    },
  );

  it.each([
    'F (Weather == "unfinished)',
    String.raw`F (Weather == "\q")`,
  ])('rejects malformed quoted strings: %s', property => {
    expect(() =>
      dpnToModelChecking(createModel('Sunny'), property),
    ).toThrow(/string literal/i);
  });
});
