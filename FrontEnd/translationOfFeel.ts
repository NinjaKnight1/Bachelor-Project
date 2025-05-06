import { parseUnaryTests, parseExpression, unaryTest } from 'feelin';
import { Tree, TreeCursor } from '@lezer/common';
const DecisionTableType = 'decisionTable';

enum ParseType { Unary, Expression };

type VariableTypes = string | number | boolean;

type DecisionTable = {
  input: Array<Expression>;
  output: Array<Expression>;
}

type Expression = {
  variableType: VariableTypes;
  text: string;
  translatedText: string | null;
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
          const translatedText = translateFeelToSmtLib(text, ParseType.Expression);

          let expression: Expression = {
            variableType: variableType,
            text: text,
            translatedText: translatedText,
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


function translateFeelToSmtLib(expression: string, parseType: ParseType): string {
  // Parse the expression using the feel parser
  let tree: Tree;
  switch (parseType) {
    case ParseType.Unary:
      tree = parseUnaryTests(expression);
      break;
    case ParseType.Expression:
      tree = parseExpression(expression);
      break;
  }
  const smtLib = walkTree(tree.cursor(), expression);
  console.log('expression', expression);
  console.log('tree', tree.toString());
  console.log('smtLib', smtLib);
  return smtLib;
}

function walkTree(cursor: TreeCursor, expression: string): string {
  switch (cursor.node.type.name) {
    case 'Expression': // start of the expression
      cursor.firstChild();
      let result = walkTree(cursor, expression);
      cursor.parent();
      return result;
    case 'NumericLiteral': // write the number
      return expression.substring(cursor.from, cursor.to);
    case 'ArithmeticExpression':
      cursor.firstChild();
      let left = walkTree(cursor, expression);
      cursor.nextSibling();
      let operator = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let right = walkTree(cursor, expression);
      cursor.parent();
      return "("+ operator + " " + left + " " + right + ")";
    case 'ParenthesizedExpression':
      cursor.firstChild();
      cursor.nextSibling();
      let inner = walkTree(cursor, expression);
      cursor.parent();
      return inner;
    case 'VariableName':
      return expression.substring(cursor.from, cursor.to);
    case 'FunctionInvocation':
      cursor.firstChild();
      let functionName = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let arg = walkTree(cursor, expression);
      cursor.parent();
      return "(" + functionName + " " + arg + ")";

    //String
    case 'StringLiteral':
      return expression.substring(cursor.from, cursor.to);

    //Boolean
    case 'BooleanLiteral':
      return expression.substring(cursor.from, cursor.to);

    default:
      return '';
  }
}

export { translateFeelToSmtLib, ParseType };