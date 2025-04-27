import { parseUnaryTests, unaryTest } from 'feelin';
import { Tree, TreeCursor } from '@lezer/common';
const DecisionTableType = 'decisionTable';

type VariableTypes = string | number | boolean;

type DecisionTable = {
  input: Array<Expression>;
  output: Array<Expression>;
}

type Expression = {
  variableType: VariableTypes;
  text: string;
  translatedText: string|null;
  rules: Array<Rows>;
}

type Rows = {
  variableType: Array<VariableTypes>;
  text: string;
  translatedText: string;
}


export function feelToSmtLib(dmnModeler: any) {
  guardsFromDmnmodeler(dmnModeler);
  // const viewer = dmnModeler.getActiveViewer();
  // console.log('view', viewer);
  // const decision = viewer._decision;
  // const decisionTable = decision.decisionLogic.rule;
  // console.log('decisionTable', decisionTable);
  // for (const r of decisionTable) {
  //   const cellTxt = r.inputEntry[0].text;
  //   const unaryAst   = parseUnaryTests(cellTxt);
  //   console.log('unaryAst', unaryAst.toString());
  // }
  // const src = "if amount > 100 then \"VIP\" else \"STD\"";
  // const unaryAst = parseUnaryTests(src).cursor();
  // console.log(unaryAst.toString()); 
  // console.log(unaryAst.node.type.name); // "IfElse"
}
export function guardsFromDmnmodeler(dmnModeler: any) {
  const viewList: Array<any> = dmnModeler.getViews();

  var decisionTables = new Array<DecisionTable>();

  viewList.forEach(view => {
    switch (view.type) {
      case DecisionTableType:
        var decisionTable: DecisionTable = {
          input: [],
          output: []
        };
        // this is the decision table header
        const decisionLogicInfo = view.element.decisionLogic;
        decisionLogicInfo.input.forEach((input: any) => {
          const inputExpression = input.inputExpression;
          const variableType = inputExpression.typeRef;
          const text = inputExpression.text;

          // translating the text from feel to smtlib
          const translatedText = translateFeelToSmtLib(text);


          let expression: Expression = {
            variableType: variableType,
            text: text,
            translatedText: null,
            rules: []
          };

        });
        const inputExpressionType = decisionLogicInfo;
        // extracting the input header
        console.log('DecisionTableHeader', decisionLogicInfo);


        // this is the decision table rules
        const decisiontableRules = decisionLogicInfo.rule;
        console.log('DecisionTable', decisiontableRules);
        break;
      default:
        break;

    }
  });

}


function translateFeelToSmtLib(expression: string): string {
  // Parse the expression using the feel parser
  const treeCursor = parseUnaryTests(expression).cursor();

  


  return '';
}

