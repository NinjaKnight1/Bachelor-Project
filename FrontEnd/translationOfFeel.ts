import { parseUnaryTests, parseExpression, unaryTest } from 'feelin';
import { Tree, TreeCursor } from '@lezer/common';
import { ModdleElement } from 'bpmn-js/lib/model/Types';
const DecisionTableType = 'decisionTable';
const Error = '⚠';

enum ParseType { Unary, Expression };

enum hitPolicyType {
  Unique = 'UNIQUE',
  First = 'FIRST'
}

type VariableTypes = string | number | boolean;

type DecisionTable = {
  tableId: string;
  hitPolicy: string;
  inputs: Array<Expression>;
  outputs: Array<Expression>;
  rules: Array<Rule>;
}

type Expression = {
  expression: string;
}

type Rule = {
  row: number;
  pre: string;
  post: string;
}
type GateGuards = {
  sourceId: string;
  targetId: string;
  expression: string;
}

type DiagramDecision = {
  meta: string | null;
  bpmn: Array<GateGuards>;
  dmn: Array<DecisionTable>;
}

export function jsonFromBpmnAndDmn(bpmnModeler: any, dmnModeler: any): File {
  let diagramDecision: DiagramDecision = parseDecisionFromfeelToSmtLib(bpmnModeler, dmnModeler);

  let diagramDecisionJson = JSON.stringify(diagramDecision);
  const jsonOutputFile = new File([diagramDecisionJson], "diagramDecisions.json", { type: "text/json" });

  return jsonOutputFile;
}


export function parseDecisionFromfeelToSmtLib(bpmnModeler: any, dmnModeler: any): DiagramDecision {

  let decisionTables = guardsFromDmnmodeler(dmnModeler);
  let gateGuards = guardsFromBpmnmodeler(bpmnModeler);

  let jsonOutput: DiagramDecision = {
    meta: null,
    bpmn: gateGuards,
    dmn: decisionTables
  }

  return jsonOutput;
}


function guardsFromBpmnmodeler(bpmnModeler: any): Array<GateGuards> {
  let guardsExpressionList: Array<GateGuards> = [];

  const definitions = bpmnModeler._definitions;
  const rootElements: Array<any> = definitions.rootElements;
  rootElements.forEach((rootElement: any) => {
    let artifacts: Array<any> = rootElement.artifacts;
    artifacts.forEach((artifact: any) => {
      switch (artifact.$type) {
        case 'bpmn:Association':
          const artifactSourceRef = artifact.sourceRef;
          if (artifactSourceRef.sourceRef.$type == 'bpmn:ExclusiveGateway') {
            const gateText = artifact.targetRef.text;
            const translatedGateText = translateFeelToSmtLib(gateText, ParseType.Expression);
            const sourceId = artifactSourceRef.sourceRef.id;
            const targetId = artifactSourceRef.targetRef.id;
            let guard: GateGuards = {
              sourceId: sourceId,
              targetId: targetId,
              expression: translatedGateText,
            }
            guardsExpressionList.push(guard);
          }
          break;

        default:
          break;
      }
    });
  });
  return guardsExpressionList;
}



function guardsFromDmnmodeler(dmnModeler: any): Array<DecisionTable> {
  const viewList: Array<any> = dmnModeler.getViews();

  var decisionTableList = new Array<DecisionTable>();

  // Going through all the list in the decision table
  viewList.forEach(view => {
    switch (view.type) {
      case DecisionTableType:
        const decisionLogicInfo = view.element.decisionLogic;
        const decisionTableId = view.element.id;
        const hitPolicy = decisionLogicInfo.hitPolicy;

        // The rules for this decision table
        let ruleList: Array<Rule> = [];

        // this is the decision table header
        let inputHeader: Array<Expression> = [];
        let outputHeader: Array<Expression> = [];

        decisionLogicInfo.input.forEach((input: any) => {
          const inputExpression = input.inputExpression;
          const inputText = inputExpression.text;
          // translating the text from feel to smtlib
          const translatedText = translateFeelToSmtLib(inputText, ParseType.Expression);
          inputHeader.push({ expression: translatedText });
        });
        decisionLogicInfo.output.forEach((output: any) => {
          const outputName = output.name;

          const translatedText = translateFeelToSmtLib(outputName, ParseType.Expression);
          outputHeader.push({ expression: translatedText });

        });

        // rules combined for each row
        const rules: Array<any> = decisionLogicInfo.rule;


        let allInputRows = []
        for (let rowNumber = 0; rowNumber < rules.length; rowNumber++) {
          let rulesRow = rules.at(rowNumber);
          let inputRow = [];
          let outputRow = [];


          const inputEntry = rulesRow.inputEntry;
          const outputEntry = rulesRow.outputEntry;

          for (let inputColumn = 0; inputColumn < inputEntry.length; inputColumn++) {
            const inputText = inputEntry.at(inputColumn).text;

            const translatedText = translateFeelToSmtLib(inputText, ParseType.Unary, inputHeader.at(inputColumn)?.expression);
            inputRow.push(translatedText);
          }

          let inputRowRule = listWithExpression(inputRow, 'and');
          allInputRows.push(inputRowRule);

          let preCondition: string = '';
          let postCondition: string = '';


          switch (hitPolicy) {
            case hitPolicyType.Unique:
              preCondition = inputRowRule;

              break;
            case hitPolicyType.First:
              preCondition = inputRowRule;
              break;
            default:
              return
          }

          for (let outputColumn = 0; outputColumn < outputEntry.length; outputColumn++) {
            const outputText = outputEntry.at(outputColumn).text;

            const translatedText = translateFeelToSmtLib(outputText, ParseType.Unary, outputHeader.at(outputColumn)?.expression);
            outputRow.push(translatedText);
          }

          postCondition = listWithExpression(outputRow, 'and');


          let rule: Rule = {
            row: rowNumber,
            pre: preCondition,
            post: postCondition,
          }
          ruleList.push(rule);
        }

        let decisionTable: DecisionTable = {
          tableId: decisionTableId,
          hitPolicy: hitPolicy,
          inputs: inputHeader,
          outputs: outputHeader,
          rules: ruleList,
        }
        decisionTableList.push(decisionTable);
        break;
      default:
        break;

    }
  });

  return decisionTableList;

}


function translateFeelToSmtLib(expression: string, parseType: ParseType, headerExpression: string = ''): string {
  // Parse the expression using the feel parser
  if (expression == '' || expression == null) {
    return '';
  }
  let tree: Tree;
  let smtLib: string;
  switch (parseType) {
    case ParseType.Unary:
      tree = parseUnaryTests(expression);
      smtLib = walkTreeUnary(tree.cursor(), expression, headerExpression);
      break;
    case ParseType.Expression:
      tree = parseExpression(expression);
      smtLib = walkTree(tree.cursor(), expression);
      break;
  }
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
    case 'Comparison':
    case 'ArithmeticExpression':
      cursor.firstChild();
      let left = walkTree(cursor, expression);
      cursor.nextSibling();
      let operator = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let right = walkTree(cursor, expression);
      cursor.parent();
      return "(" + operator + " " + left + " " + right + ")";
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

function walkTreeUnary(cursor: TreeCursor, expression: string, headerExpression: string): string {
  switch (cursor.node.type.name) {
    case 'UnaryTests': // start of the expression
      cursor.firstChild();
      let result = walkTreeUnary(cursor, expression, headerExpression);
      cursor.parent();
      return result;
    case 'PositiveUnaryTests':
      let positiveUnaryTestsList: Array<string> = [];
      cursor.firstChild();
      positiveUnaryTestsList.push(walkTreeUnary(cursor, expression, headerExpression));
      while (cursor.nextSibling()) {
        positiveUnaryTestsList.push(walkTreeUnary(cursor, expression, headerExpression));
      }
      cursor.parent();

      return listWithExpression(positiveUnaryTestsList, 'or');
    case 'PositiveUnaryTest':
      cursor.firstChild();
      let positiveUnaryTestString = positiveUnaryTest(cursor, expression, headerExpression);
      cursor.parent();
      return positiveUnaryTestString;
    case 'Wildcard':
      cursor.firstChild();
      let wildcard = expression.substring(cursor.from, cursor.to);
      if (wildcard === '-') {
        cursor.parent();
        return 'true';
      } else {
        // if the wildcard is not a dash, then it is not a 
        cursor.parent();
        return '';
      }
    default:
      return '';
  }


}



function positiveUnaryTest(cursor: TreeCursor, expression: string, headerExpression: string): string {
  switch (cursor.node.type.name) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'VariableName':
      return "(= " + headerExpression + " " + expression.substring(cursor.from, cursor.to) + ")";

    case 'SimplePositiveUnaryTest':
      cursor.firstChild();
      let simplePositiveUnaryTest = positiveUnaryTest(cursor, expression, headerExpression);
      cursor.parent();
      return simplePositiveUnaryTest;

    case 'Interval':
      // get the first bracket either ( or [
      cursor.firstChild();
      const openingBracket = expression.substring(cursor.from, cursor.to);

      // initialise the lower and upper expression
      let lowerExpression, upperExpression: string | null = null;

      // move to the next sibling
      // get the expression if there is one
      cursor.nextSibling();
      if (isAnExpressionInInterval(cursor)) {
        lowerExpression = walkTree(cursor, expression);
      }

      // move to the next sibling
      // get the expression if there is one
      cursor.nextSibling();
      if (isAnExpressionInInterval(cursor)) {
        upperExpression = walkTree(cursor, expression);
        cursor.nextSibling();
      }

      // get the last bracket either ) or ]
      const closingBracket = expression.substring(cursor.from, cursor.to);

      // moving back to the parent
      cursor.parent();

      let expressions: Array<string> = [];
      if (lowerExpression !== null && lowerExpression != '' && lowerExpression !== undefined) {
        if (openingBracket === '(') {
          expressions.push("(> " + headerExpression + " " + lowerExpression + ")");
        } else if (openingBracket === '[') {
          expressions.push("(>= " + headerExpression + " " + lowerExpression + ")");
        }
      }
      if (upperExpression !== null && upperExpression != '' && lowerExpression !== undefined) {
        if (closingBracket === ')') {
          expressions.push("(< " + headerExpression + " " + upperExpression + ")");
        } else if (closingBracket === ']') {
          expressions.push("(<= " + headerExpression + " " + upperExpression + ")");
        }
      }
      return listWithExpression(expressions, 'and');

    case 'CompareOp': // compare operator with a value or variable
      let compareOp = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let compareValue = walkTree(cursor, expression);
      return '(' + compareOp + ' ' + headerExpression + ' ' + compareValue + ')';

    default:
      return '';
  }


}

function isAnExpressionInInterval(cursor: TreeCursor): boolean {
  switch (cursor.node.type.name) {
    case Error:                // if the values in the interval is not there
      return false;
    default:
      return true;
  }
}

function listWithExpression(list: Array<string>, operator: string): string {
  let length = list.length;
  let output: string = list[length - 1];
  for (let i = length - 2; i >= 0; i--) {
    output = "(" + operator + " " + list[i] + " " + output + ")";
  }
  return output;
}


export { translateFeelToSmtLib, ParseType };