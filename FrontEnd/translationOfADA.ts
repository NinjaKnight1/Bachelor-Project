import { parseUnaryTests, parseExpression } from 'feelin';
import { Tree, TreeCursor } from '@lezer/common';
import { UnsupportedFeelError, TranslationError } from './customErrors';

const DecisionTableType = 'decisionTable';
const ErrorNode = '⚠';

enum ParseType {
  Unary,
  Expression
}

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
};

type Expression = {
  expression: string;
};

type Rule = {
  row: number;
  pre: string;
  post: string;
};

type GateGuards = {
  sourceId: string;
  targetId: string;
  pre: string;
  post: string;
};

export type Variable = {
  name: string;
  type: VariableTypes;
  value: string;
};

function buildVariablesFromNames(
  variableNames: string[],
  existingVariables: Variable[] = []
): Variable[] {
  return variableNames.map(name => {
    const existing = existingVariables.find(variable => variable.name === name);

    return existing ?? {
      name,
      type: VariableTypes.string,
      value: ''
    };
  });
}

function extractCandidateVariableNames(expression: string): string[] {
  const tokens = expression.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
  const blocked = new Set([
    'true',
    'false',
    'and',
    'or',
    'not',
    'in',
    'between',
    'null',
    'undefined'
  ]);

  return tokens.filter(token => !blocked.has(token.toLowerCase()));
}

export function extractVariablesFromDmnmodeler(dmnModeler: any): string[] {
  if (!dmnModeler) return [];
 
  const viewList: Array<any> = dmnModeler.getViews?.() ?? [];
  const variableNameSet = new Set<string>();
 
  console.debug('[extractVariables] views found:', viewList.length);
 
  viewList.forEach(view => {
    if (view.type !== 'decisionTable') return;
 
    const decisionLogic = view.element?.decisionLogic;
    if (!decisionLogic) {
      console.debug('[extractVariables] no decisionLogic on view:', view.id);
      return;
    }
 
    // Read each input column's header expression text directly.
    // This is the variable name the user typed in the DMN input header,
    // e.g. "age", "order status", "customerCategory".
    decisionLogic.input?.forEach((input: any) => {
      const text: string | undefined = input?.inputExpression?.text?.trim();
      console.debug('[extractVariables] input expression text:', text);
      if (text) {
        variableNameSet.add(text);
      }
    });
  });
 
  const result = Array.from(variableNameSet).sort();
  console.debug('[extractVariables] extracted variable names:', result);
  return result;
}

type DiagramDecision = {
  meta: string | null;
  bpmn: Array<GateGuards>;
  dmn: Array<DecisionTable>;
  variableName: Array<Variable> | Array<string>;
};

export async function jsonFromBpmnAndDmn(
  bpmnModeler: any,
  dmnModeler: any,
  existingVariables: Variable[] = []
): Promise<File | null> {
  try {
    const diagramDecision: DiagramDecision = parseDecisionFromfeelToSmtLib(
      bpmnModeler,
      dmnModeler
    );

    const variableNames = Array.isArray(diagramDecision.variableName)
      ? diagramDecision.variableName.filter((name): name is string => typeof name === 'string')
      : [];

    diagramDecision.variableName = buildVariablesFromNames(
      variableNames,
      existingVariables
    );

    const diagramDecisionJson = JSON.stringify(diagramDecision);
    const jsonOutputFile = new File(
      [diagramDecisionJson],
      'diagramDecisions.json',
      { type: 'text/json' }
    );

    return jsonOutputFile;
  } catch (error) {
    if (error instanceof TranslationError) {
      throw new TranslationError(error.error, 'DMN/BPMN');
    } else {
      throw new TranslationError([error], 'DMN/BPMN');
    }
  }
}

export function parseDecisionFromfeelToSmtLib(
  bpmnModeler: any,
  dmnModeler: any
): DiagramDecision {
  try {
    const [decisionTableList, decisionTableVariableNameSet] =
      guardsFromDmnmodeler(dmnModeler);
    const [gateGuardList, gateGuardVariableNameSet] =
      guardsFromBpmnmodeler(bpmnModeler);

    gateGuardVariableNameSet.forEach(name =>
      decisionTableVariableNameSet.add(name)
    );

    const variableNameList = [...decisionTableVariableNameSet];

    const jsonOutput: DiagramDecision = {
      meta: null,
      bpmn: gateGuardList,
      dmn: decisionTableList,
      variableName: variableNameList
    };

    return jsonOutput;
  } catch (error) {
    if (error instanceof TranslationError) {
      throw new TranslationError(error.error, 'DMN/BPMN');
    } else {
      throw new TranslationError([error], 'DMN/BPMN');
    }
  }
}

function guardsFromBpmnmodeler(
  bpmnModeler: any
): [Array<GateGuards>, Set<string>] {
  const guardsExpressionList: Array<GateGuards> = [];
  const variableNameSet = new Set<string>();
  const errorList: Array<string> = [];

  const definitions = bpmnModeler._definitions;
  const rootElementList: Array<any> = definitions.rootElements || [];

  if (!(rootElementList.length > 0)) {
    return [guardsExpressionList, variableNameSet];
  }

  for (const rootElement of rootElementList) {
    const artifactList: Array<any> = rootElement.artifacts || [];

    if (!(artifactList.length > 0)) {
      continue;
    }

    for (const artifact of artifactList) {
      switch (artifact.$type) {
        case 'bpmn:Association': {
          const artifactSourceRef = artifact.sourceRef;

          if (artifactSourceRef.sourceRef.$type === 'bpmn:ExclusiveGateway') {
            const gateText = artifact.targetRef.text;

            try {
              const [translatedGateText, gateGuardVariableNameSet] =
                translateFeelToSmtLib(gateText, ParseType.Expression);

              gateGuardVariableNameSet.forEach(name =>
                variableNameSet.add(name)
              );

              const sourceId = artifactSourceRef.sourceRef.id;
              const targetId = artifactSourceRef.targetRef.id;

              const guard: GateGuards = {
                sourceId,
                targetId,
                pre: translatedGateText,
                post: 'true'
              };

              guardsExpressionList.push(guard);
            } catch (error) {
              if (error instanceof UnsupportedFeelError) {
                errorList.push(error.message);
              }
            }
          }
          break;
        }

        default:
          break;
      }
    }
  }

  if (errorList.length > 0) {
    throw new TranslationError(errorList);
  }

  return [guardsExpressionList, variableNameSet];
}

export function guardsFromDmnmodeler(
  dmnModeler: any
): [Array<DecisionTable>, Set<string>] {
  const viewList: Array<any> = dmnModeler.getViews();

  const decisionTableList = new Array<DecisionTable>();
  const variableNameSet = new Set<string>();
  const errorList: Array<string> = [];

  viewList.forEach(view => {
    switch (view.type) {
      case DecisionTableType: {
        const decisionLogicInfo = view.element.decisionLogic;
        const decisionTableId = view.element.id;
        const hitPolicy = decisionLogicInfo.hitPolicy;

        const ruleList: Array<Rule> = [];
        const inputHeader: Array<Expression> = [];
        const outputHeader: Array<Expression> = [];

        decisionLogicInfo.input.forEach((input: any) => {
          const inputExpression = input.inputExpression;
          const inputText = inputExpression.text;

          try {
            const [translatedText, inputVariableNames] = translateFeelToSmtLib(
              inputText,
              ParseType.Expression
            );
            inputVariableNames.forEach(name => variableNameSet.add(name));
            inputHeader.push({ expression: translatedText });
          } catch (error) {
            if (error instanceof UnsupportedFeelError) {
              errorList.push(
                error.message +
                  ` in decisiontable with the name "${view.name}", in the input header`
              );
            }
          }
        });

        decisionLogicInfo.output.forEach((output: any) => {
          const outputName = output.name;

          try {
            const [translatedText, inputVariableNames] = translateFeelToSmtLib(
              outputName,
              ParseType.Expression
            );
            inputVariableNames.forEach(name => variableNameSet.add(name));
            outputHeader.push({ expression: translatedText });
          } catch (error) {
            if (error instanceof UnsupportedFeelError) {
              errorList.push(
                error.message +
                  ` in decisiontable with the name "${view.name}", in the output header`
              );
            }
          }
        });

        const rules: Array<any> = decisionLogicInfo.rule;
        const allInputRows: Array<string> = [];

        if (rules == undefined || rules == null) {
          break;
        }

        for (let rowNumber = 0; rowNumber < rules.length; rowNumber++) {
          const rulesRow = rules[rowNumber];
          const inputRow: Array<string> = [];
          const outputRow: Array<string> = [];

          const inputEntry = rulesRow.inputEntry;
          const outputEntry = rulesRow.outputEntry;

          for (let inputColumn = 0; inputColumn < inputEntry.length; inputColumn++) {
            let inputText = inputEntry.at(inputColumn).text;
            if (inputText === '') {
              inputText = '-';
            }

            try {
              const [translatedText, inputVariableNames] = translateFeelToSmtLib(
                inputText,
                ParseType.Unary,
                inputHeader.at(inputColumn)?.expression
              );

              inputVariableNames.forEach(name => variableNameSet.add(name));
              inputRow.push(translatedText);
            } catch (error) {
              console.error(error);
              if (error instanceof UnsupportedFeelError) {
                console.log(error.message);
                errorList.push(
                  error.message +
                    ` in decisiontable with the name "${view.name}", there is a error in input column ${inputColumn} and row ${rowNumber}`
                );
              }
            }
          }

          const inputRowRule = listWithExpression(inputRow, 'and');

          let preCondition = '';
          let postCondition = '';

          switch (hitPolicy) {
            case hitPolicyType.Unique:
              preCondition = inputRowRule;
              break;

            case hitPolicyType.First:
              if (rowNumber === 0) {
                preCondition = inputRowRule;
              } else {
                const previousRows = listWithExpression(allInputRows, 'or');
                const notPreviousRows = negateFormulaAda(previousRows);
                preCondition = listWithExpression(
                  [notPreviousRows, inputRowRule],
                  'and'
                );
              }
              break;

            default:
              break;
          }

          allInputRows.push(inputRowRule);

          for (let outputColumn = 0; outputColumn < outputEntry.length; outputColumn++) {
            const outputText = outputEntry.at(outputColumn).text;

            try {
              const outputHeaderExpression =
                outputHeader.at(outputColumn)?.expression ?? '';
              const primedOutputHeaderExpression = outputHeaderExpression
                ? `${outputHeaderExpression}'`
                : outputHeaderExpression;

              const [translatedText, inputVariableNames] = translateFeelToSmtLib(
                outputText,
                ParseType.Unary,
                primedOutputHeaderExpression
              );

              inputVariableNames.forEach(name => variableNameSet.add(name));
              outputRow.push(translatedText);
            } catch (error) {
              if (error instanceof UnsupportedFeelError) {
                errorList.push(
                  error.message +
                    ` in decisiontable with the name "${view.name}", there is a error in output column ${outputColumn} and row ${rowNumber}`
                );
              }
            }
          }

          postCondition = listWithExpression(outputRow, 'and');

          const rule: Rule = {
            row: rowNumber,
            pre: preCondition,
            post: postCondition
          };

          ruleList.push(rule);
        }

        const decisionTable: DecisionTable = {
          tableId: decisionTableId,
          hitPolicy,
          inputs: inputHeader,
          outputs: outputHeader,
          rules: ruleList
        };

        decisionTableList.push(decisionTable);
        break;
      }

      default:
        break;
    }
  });

  if (errorList.length > 0) {
    throw new TranslationError(errorList);
  }

  return [decisionTableList, variableNameSet];
}

function translateFeelToSmtLib(
  expression: string,
  parseType: ParseType,
  headerExpression: string = ''
): [string, Set<string>] {
  if (expression == '' || expression == null) {
    throw new UnsupportedFeelError('Expression is empty', expression);
  }

  const variableNameSet = new Set<string>();
  let tree: Tree;
  let translated: string;

  switch (parseType) {
    case ParseType.Unary:
      tree = parseUnaryTests(expression, {}, undefined);
      translated = walkTreeUnary(
        tree.cursor(),
        expression,
        headerExpression,
        variableNameSet
      );
      break;

    case ParseType.Expression:
      tree = parseExpression(expression, {}, undefined);
      translated = walkTree(tree.cursor(), expression, variableNameSet);
      break;

    default:
      throw new UnsupportedFeelError('Unknown parse type', expression);
  }

  return [translated, variableNameSet];
}

function walkTree(
  cursor: TreeCursor,
  expression: string,
  variableNameSet: Set<string>
): string {
  switch (cursor.node.type.name) {
    case 'Expression': {
      cursor.firstChild();
      const result = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return result;
    }

    case 'Comparison':
    case 'ArithmeticExpression': {
      cursor.firstChild();
      const left = walkTree(cursor, expression, variableNameSet);

      cursor.nextSibling();
      let operator = expression.substring(cursor.from, cursor.to);
      if (operator === '=') {
        operator = '==';
      }

      cursor.nextSibling();
      const right = walkTree(cursor, expression, variableNameSet);
      cursor.parent();

      return '(' + left + ' ' + operator + ' ' + right + ')';
    }

    case 'ParenthesizedExpression': {
      cursor.firstChild();
      cursor.nextSibling();
      const inner = walkTree(cursor, expression, variableNameSet);
      cursor.parent();
      return inner;
    }

    case 'VariableName': {
      const variableName = expression.substring(cursor.from, cursor.to);
      variableNameSet.add(variableName);
      return variableName;
    }

    case 'FunctionInvocation': {
      cursor.firstChild();
      const functionName = expression.substring(cursor.from, cursor.to);

      const args: Array<string> = [];

      while (cursor.nextSibling()) {
        const nodeText = expression.substring(cursor.from, cursor.to).trim();

        if (
          nodeText === '' ||
          nodeText === '(' ||
          nodeText === ')' ||
          nodeText === ','
        ) {
          continue;
        }

        args.push(walkTree(cursor, expression, variableNameSet));
      }

      cursor.parent();
      return functionName + '(' + args.join(', ') + ')';
    }

    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NumericLiteral':
      return expression.substring(cursor.from, cursor.to);

    default:
      throw new UnsupportedFeelError(cursor.node.type.name, expression);
  }
}

function walkTreeUnary(
  cursor: TreeCursor,
  expression: string,
  headerExpression: string,
  variableNameSet: Set<string>
): string {
  switch (cursor.node.type.name) {
    case 'UnaryTests': {
      cursor.firstChild();
      const result = walkTreeUnary(
        cursor,
        expression,
        headerExpression,
        variableNameSet
      );
      cursor.parent();
      return result;
    }

    case 'PositiveUnaryTests': {
      const positiveUnaryTestsList: Array<string> = [];

      cursor.firstChild();
      positiveUnaryTestsList.push(
        walkTreeUnary(cursor, expression, headerExpression, variableNameSet)
      );

      while (cursor.nextSibling()) {
        positiveUnaryTestsList.push(
          walkTreeUnary(cursor, expression, headerExpression, variableNameSet)
        );
      }

      cursor.parent();
      return listWithExpression(positiveUnaryTestsList, 'or');
    }

    case 'PositiveUnaryTest': {
      cursor.firstChild();
      const positiveUnaryTestString = positiveUnaryTest(
        cursor,
        expression,
        headerExpression,
        variableNameSet
      );
      cursor.parent();
      return positiveUnaryTestString;
    }

    case 'Wildcard': {
      cursor.firstChild();
      const wildcard = expression.substring(cursor.from, cursor.to);
      cursor.parent();

      if (wildcard === '-') {
        return 'true';
      }
      return '';
    }

    case 'not': {
      cursor.nextSibling();
      cursor.nextSibling();
      const inner = walkTreeUnary(
        cursor,
        expression,
        headerExpression,
        variableNameSet
      );
      cursor.parent();
      return negateFormulaAda(inner);
    }

    default:
      throw new UnsupportedFeelError(cursor.node.type.name, expression);
  }
}

function positiveUnaryTest(
  cursor: TreeCursor,
  expression: string,
  headerExpression: string,
  variableNameSet: Set<string>
): string {
  switch (cursor.node.type.name) {
    case 'StringLiteral':
    case 'BooleanLiteral':
    case 'NumericLiteral': {
      const literal = expression.substring(cursor.from, cursor.to);
      return '(' + headerExpression + ' == ' + literal + ')';
    }

    case 'VariableName': {
      const variableName = expression.substring(cursor.from, cursor.to);
      variableNameSet.add(variableName);
      return '(' + headerExpression + ' == ' + variableName + ')';
    }

    case 'SimplePositiveUnaryTest': {
      cursor.firstChild();
      const simplePositiveUnaryTest = positiveUnaryTest(
        cursor,
        expression,
        headerExpression,
        variableNameSet
      );
      cursor.parent();
      return simplePositiveUnaryTest;
    }

    case 'Interval': {
      cursor.firstChild();
      const openingBracket = expression.substring(cursor.from, cursor.to);

      let lowerExpression: string | null = null;
      let upperExpression: string | null = null;

      cursor.nextSibling();
      if (isAnExpressionInInterval(cursor)) {
        lowerExpression = walkTree(cursor, expression, variableNameSet);
      }

      cursor.nextSibling();
      if (isAnExpressionInInterval(cursor)) {
        upperExpression = walkTree(cursor, expression, variableNameSet);
        cursor.nextSibling();
      }

      const closingBracket = expression.substring(cursor.from, cursor.to);
      cursor.parent();

      const expressions: Array<string> = [];

      if (lowerExpression !== null && lowerExpression !== '') {
        if (openingBracket === '(') {
          expressions.push('(' + headerExpression + ' > ' + lowerExpression + ')');
        } else if (openingBracket === '[') {
          expressions.push('(' + headerExpression + ' >= ' + lowerExpression + ')');
        }
      }

      if (upperExpression !== null && upperExpression !== '') {
        if (closingBracket === ')') {
          expressions.push('(' + headerExpression + ' < ' + upperExpression + ')');
        } else if (closingBracket === ']') {
          expressions.push('(' + headerExpression + ' <= ' + upperExpression + ')');
        }
      }

      return listWithExpression(expressions, 'and');
    }

    case 'CompareOp': {
      let compareOp = expression.substring(cursor.from, cursor.to);
      if (compareOp === '=') {
        compareOp = '==';
      }

      cursor.nextSibling();
      const compareValue = walkTree(cursor, expression, variableNameSet);
      return '(' + headerExpression + ' ' + compareOp + ' ' + compareValue + ')';
    }

    default:
      throw new UnsupportedFeelError(cursor.node.type.name, expression);
  }
}

function isAnExpressionInInterval(cursor: TreeCursor): boolean {
  switch (cursor.node.type.name) {
    case ErrorNode:
      return false;
    default:
      return true;
  }
}

function listWithExpression(list: Array<string>, operator: string): string {
  const filtered = list.filter(item => item != null && item.trim() !== '');

  if (filtered.length === 0) {
    return 'true';
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  const op = operator === 'and' ? '&&' : '||';
  return '(' + filtered.join(' ' + op + ' ') + ')';
}

function stripOuterParens(expr: string): string {
  const trimmed = expr.trim();

  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return trimmed;
  }

  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }

    if (depth === 0 && i < trimmed.length - 1) {
      return trimmed;
    }
  }

  return trimmed.slice(1, -1).trim();
}

function splitTopLevel(expr: string, op: '&&' | '||'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }

    if (depth === 0 && expr.slice(i, i + op.length) === op) {
      parts.push(expr.slice(start, i).trim());
      start = i + op.length;
      i += op.length - 1;
    }
  }

  parts.push(expr.slice(start).trim());
  return parts.filter(part => part.length > 0);
}

function negateComparison(expr: string): string {
  const trimmed = stripOuterParens(expr);

  if (trimmed.includes(' == ')) {
    return '(' + trimmed.replace(' == ', ' != ') + ')';
  }
  if (trimmed.includes(' != ')) {
    return '(' + trimmed.replace(' != ', ' == ') + ')';
  }
  if (trimmed.includes(' >= ')) {
    return '(' + trimmed.replace(' >= ', ' < ') + ')';
  }
  if (trimmed.includes(' <= ')) {
    return '(' + trimmed.replace(' <= ', ' > ') + ')';
  }
  if (trimmed.includes(' > ')) {
    return '(' + trimmed.replace(' > ', ' <= ') + ')';
  }
  if (trimmed.includes(' < ')) {
    return '(' + trimmed.replace(' < ', ' >= ') + ')';
  }

  throw new UnsupportedFeelError(`Cannot negate comparison: ${expr}`, expr);
}

function negateFormulaAda(expr: string): string {
  const trimmed = stripOuterParens(expr);

  const andParts = splitTopLevel(trimmed, '&&');
  if (andParts.length > 1) {
    return '(' + andParts.map(negateFormulaAda).join(' || ') + ')';
  }

  const orParts = splitTopLevel(trimmed, '||');
  if (orParts.length > 1) {
    return '(' + orParts.map(negateFormulaAda).join(' && ') + ')';
  }

  if (trimmed === 'true') {
    return 'false';
  }
  if (trimmed === 'false') {
    return 'true';
  }

  return negateComparison(trimmed);
}