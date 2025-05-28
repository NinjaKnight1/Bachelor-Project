import { parseUnaryTests, parseExpression, unaryTest } from 'feelin';
import { Tree, TreeCursor } from '@lezer/common';
import { promptVariables } from './modalCreation';
const DecisionTableType = 'decisionTable';
const Error = '⚠';

enum ParseType { Unary, Expression };

enum hitPolicyType {
  Unique = 'UNIQUE',
  First = 'FIRST'
}


export enum VariableTypes {
  string = 'string',
  number = 'number',
  boolean = 'boolean'
}

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

export type Variable = {
  name: string;
  type: VariableTypes;
  value: string;
}

type DiagramDecision = {
  meta: string | null;
  bpmn: Array<GateGuards>;
  dmn: Array<DecisionTable>;
  variableName: Array<Variable> | Array<string>;
}



export async function jsonFromBpmnAndDmn(bpmnModeler: any, dmnModeler: any): Promise<File | null> {
  let diagramDecision: DiagramDecision = parseDecisionFromfeelToSmtLib(bpmnModeler, dmnModeler);

  if ((diagramDecision.variableName.length > 0)) {
    const variables = await promptVariables(diagramDecision.variableName as string[]);
    if (!variables) {
      return null;
    }
    diagramDecision.variableName = variables;
  }
  let diagramDecisionJson = JSON.stringify(diagramDecision);
  const jsonOutputFile = new File([diagramDecisionJson], "diagramDecisions.json", { type: "text/json" });

  return jsonOutputFile;
}


export function parseDecisionFromfeelToSmtLib(bpmnModeler: any, dmnModeler: any): DiagramDecision {

  let [decisionTableList, decisionTableVariableNameSet] = guardsFromDmnmodeler(dmnModeler);
  let [gateGuardList, gateGuardVariableNameSet] = guardsFromBpmnmodeler(bpmnModeler);
  gateGuardVariableNameSet.forEach(name => decisionTableVariableNameSet.add(name));
  let variableNameList = [...decisionTableVariableNameSet];
  let jsonOutput: DiagramDecision = {
    meta: null,
    bpmn: gateGuardList,
    dmn: decisionTableList,
    variableName: variableNameList,
  }

  return jsonOutput;
}


function guardsFromBpmnmodeler(bpmnModeler: any): [Array<GateGuards>, Set<string>] {
  let guardsExpressionList: Array<GateGuards> = [];
  let variableNameSet = new Set<string>();

  const definitions = bpmnModeler._definitions;
  const rootElementList: Array<any> = definitions.rootElements || [];
  if (!(rootElementList.length > 0)) {
    return [guardsExpressionList, variableNameSet];
  }
  for (let rootElement of rootElementList) {
    const artifactList: Array<any> = rootElement.artifacts || [];
    if (!(artifactList.length > 0)) {
      continue;
    }
    for (let artifact of artifactList) {
      switch (artifact.$type) {
        case 'bpmn:Association':
          const artifactSourceRef = artifact.sourceRef;
          if (artifactSourceRef.sourceRef.$type == 'bpmn:ExclusiveGateway') {
            const gateText = artifact.targetRef.text;
            const [translatedGateText, gateGuardVariableNameSet] = translateFeelToSmtLib(gateText, ParseType.Expression);
            gateGuardVariableNameSet.forEach(name => variableNameSet.add(name));
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
    }
  }
  return [guardsExpressionList, variableNameSet];
}



export function guardsFromDmnmodeler(dmnModeler: any): [Array<DecisionTable>, Set<string>] {
  const viewList: Array<any> = dmnModeler.getViews();

  // list of decisionTables 
  let decisionTableList = new Array<DecisionTable>();
  // set of variable names
  let variableNameSet = new Set<string>();


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

        // Going through all input headers and translating the expressions
        decisionLogicInfo.input.forEach((input: any) => {
          const inputExpression = input.inputExpression;
          const inputText = inputExpression.text;
          // translating the text from feel to smtlib
          const [translatedText, inputVariableNames] = translateFeelToSmtLib(inputText, ParseType.Expression);
          inputVariableNames.forEach(name => variableNameSet.add(name));
          inputHeader.push({ expression: translatedText });
        });

        // Going through all output headers and translating the expressions
        decisionLogicInfo.output.forEach((output: any) => {
          const outputName = output.name;

          const [translatedText, inputVariableNames] = translateFeelToSmtLib(outputName, ParseType.Expression);
          inputVariableNames.forEach(name => variableNameSet.add(name));
          outputHeader.push({ expression: translatedText });

        });

        // rules combined for each row
        const rules: Array<any> = decisionLogicInfo.rule;

        // a list rows translated to smt-lib where each column is linked with a conjunction
        let allInputRows = []

        // TODO 
        // break as there is nothing here

        for (let rowNumber = 0; rowNumber < rules.length; rowNumber++) {
          let rulesRow = rules.at(rowNumber);
          let inputRow = [];
          let outputRow = [];


          const inputEntry = rulesRow.inputEntry;
          const outputEntry = rulesRow.outputEntry;

          for (let inputColumn = 0; inputColumn < inputEntry.length; inputColumn++) {
            const inputText = inputEntry.at(inputColumn).text;

            const [translatedText, inputVariableNames] = translateFeelToSmtLib(inputText, ParseType.Unary, inputHeader.at(inputColumn)?.expression);
            inputVariableNames.forEach(name => variableNameSet.add(name));
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
            const [translatedText, inputVariableNames] = translateFeelToSmtLib(outputText, ParseType.Unary, outputHeader.at(outputColumn)?.expression);
            inputVariableNames.forEach(name => variableNameSet.add(name));
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

  return [decisionTableList, variableNameSet];

}


function translateFeelToSmtLib(expression: string, parseType: ParseType, headerExpression: string = ''): [string, Set<string>] {
  // Parse the expression using the feel parser
  if (expression == '' || expression == null) {
    return ['', new Set()];
  }
  let variableNameSet = new Set<string>();
  let tree: Tree;
  let smtLib: string;
  switch (parseType) {
    case ParseType.Unary:
      tree = parseUnaryTests(expression);
      smtLib = walkTreeUnary(tree.cursor(), expression, headerExpression, variableNameSet);
      break;
    case ParseType.Expression:
      tree = parseExpression(expression);
      smtLib = walkTree(tree.cursor(), expression, variableNameSet);
      break;
  }
  return [smtLib, variableNameSet];
}

function walkTree(cursor: TreeCursor, expression: string, variableNameSet: Set<string>): string {
  switch (cursor.node.type.name) {
    case 'Expression': // start of the expression
      cursor.firstChild();
      let result = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return result;
    case 'Comparison':
    case 'ArithmeticExpression':
      cursor.firstChild();
      let left = walkTree(cursor, expression, variableNameSet);
      cursor.nextSibling();
      let operator = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let right = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return "(" + operator + " " + left + " " + right + ")";
    case 'ParenthesizedExpression':
      cursor.firstChild();
      cursor.nextSibling();
      let inner = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return inner;
    case 'VariableName':
      let variableName = expression.substring(cursor.from, cursor.to);
      variableNameSet.add(variableName);
      return variableName;
    case 'FunctionInvocation':
      cursor.firstChild();
      let functionName = expression.substring(cursor.from, cursor.to);
      cursor.nextSibling();
      let arg = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return "(" + functionName + " " + arg + ")";

    case 'StringLiteral':   // String
    case 'BooleanLiteral':  // Boolean
    case 'NumericLiteral':  // write the number
      return expression.substring(cursor.from, cursor.to);

    default:
      return '';
  }
}

function walkTreeUnary(cursor: TreeCursor, expression: string, headerExpression: string, variableNameSet: Set<string>): string {
  switch (cursor.node.type.name) {
    case 'UnaryTests': // start of the expression
      cursor.firstChild();
      let result = walkTreeUnary(cursor, expression, headerExpression, variableNameSet);
      cursor.parent();
      return result;
    case 'PositiveUnaryTests':
      let positiveUnaryTestsList: Array<string> = [];
      cursor.firstChild();
      positiveUnaryTestsList.push(walkTreeUnary(cursor, expression, headerExpression, variableNameSet));
      while (cursor.nextSibling()) {
        positiveUnaryTestsList.push(walkTreeUnary(cursor, expression, headerExpression, variableNameSet));
      }
      cursor.parent();

      return listWithExpression(positiveUnaryTestsList, 'or');
    case 'PositiveUnaryTest':
      cursor.firstChild();
      let positiveUnaryTestString = positiveUnaryTest(cursor, expression, headerExpression, variableNameSet);
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



function positiveUnaryTest(cursor: TreeCursor, expression: string, headerExpression: string, variableNameSet: Set<string>): string {
  switch (cursor.node.type.name) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return "(= " + headerExpression + " " + expression.substring(cursor.from, cursor.to) + ")";
    case 'VariableName':
      let variableName = expression.substring(cursor.from, cursor.to);
      variableNameSet.add(variableName);
      return "(= " + headerExpression + " " + variableName + ")";

    case 'SimplePositiveUnaryTest':
      cursor.firstChild();
      let simplePositiveUnaryTest = positiveUnaryTest(cursor, expression, headerExpression, variableNameSet);
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
        lowerExpression = walkTree(cursor, expression, variableNameSet);
      }

      // move to the next sibling
      // get the expression if there is one
      cursor.nextSibling();
      if (isAnExpressionInInterval(cursor)) {
        upperExpression = walkTree(cursor, expression, variableNameSet);
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
      let compareValue = walkTree(cursor, expression, variableNameSet);
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