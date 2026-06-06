import BpmnModeler from 'bpmn-js/lib/Modeler';
import { DPN, Gateway } from './dpn';
import { decisionDiagramFromBpmnAndDmn, DiagramDecision, DecisionTable, GateGuards, Variable } from '../translationOfADA';
import { variablePanel } from '../variablePanel';

async function bpmnToPn(bpmnModeler: any, dmnModeler: any): Promise<DPN> {
  await variablePanel.updateFromDMN();
  const variableList = variablePanel.getVariables();

  // TODO: Check if all variables have a value.

  const diagramDecision: DiagramDecision = decisionDiagramFromBpmnAndDmn(
    bpmnModeler,
    dmnModeler,
  );
  const gateGuardMap = diagramDecision.bpmn;
  const decisionTableMap = diagramDecision.dmn;


  let dpn = new DPN();

  dpn.variables = variableList;

  let definitions = bpmnModeler.getDefinitions()
  let diagramList = definitions.diagrams;
  diagramList.forEach((diagram: any) => {
    let plane = diagram.plane;
    let bpmnElement = plane.bpmnElement;
    let flowElementList = bpmnElement.flowElements;
    // let artifactList = bpmnElement.artifacts;
    // console.log(typeof flowElementList);
    // console.log(flowElementList);

    flowElementList.forEach((flowElement: any) => {
      switch (flowElement.$type) {
        case 'bpmn:SequenceFlow':
          const flowId = flowElement.id;
          dpn.addPlace(flowId);
          break;
        default:
          break;
      }
    });

    flowElementList.forEach((flowElement: any) => {
      switch (flowElement.$type) {
        case 'bpmn:Task':
          const taskId = flowElement.id;
          const taskName = flowElement.name ?? null;
          dpn.addTransition(taskId, taskName);


          const taskIncomingIdList = flowToId(flowElement.incoming);
          taskIncomingIdList.forEach(incomingId => {
            dpn.addArc(incomingId, taskId);
          });

          const taskOutgoingIdList = flowToId(flowElement.outgoing);
          taskOutgoingIdList.forEach(outgoingId => {
            dpn.addArc(taskId, outgoingId);
          });
          break;
        case 'bpmn:BusinessRuleTask':
          const businessTaskId = flowElement.id;
          const businessTaskName = flowElement.name ?? null;
          const decisionTable = decisionTableMap.get(businessTaskId);
          if (decisionTable == undefined) {
            throw new Error(
              'Could not find a matching DMN decision table for BusinessRuleTask "' +
              businessTaskName +
              '". Expected a table id matching the task id, name, or decision reference.',
            );
          }
          const rules = decisionTable.rules;
          rules.forEach((rule, index) => {
            const businessTaskGaurdId = businessTaskId + "_" + index;
            dpn.addTransition(businessTaskGaurdId, businessTaskName, null, rule.pre + " && " + rule.post);


            const businessTaskIncomingIdList = flowToId(flowElement.incoming);
            businessTaskIncomingIdList.forEach(incomingId => {
              dpn.addArc(incomingId, businessTaskGaurdId);
            });

            const businessTaskOutgoingIdList = flowToId(flowElement.outgoing);
            businessTaskOutgoingIdList.forEach(outgoingId => {
              dpn.addArc(businessTaskGaurdId, outgoingId);
            });
          });

          break;

        case 'bpmn:StartEvent':
          const startId = flowElement.id;
          const startName = flowElement.name ?? null;

          dpn.addTransition(startId, startName);

          const startOutgoingIdList = flowToId(flowElement.outgoing);
          startOutgoingIdList.forEach(outgoingId => {
            dpn.addArc(startId, outgoingId);
          });
          dpn.addArcToStartTransition(startId);
          break;
        case 'bpmn:EndEvent':
          const endId = flowElement.id;
          const endName = flowElement.name ?? null;

          dpn.addTransition(endId, endName);

          const endIncomingIdList = flowToId(flowElement.incoming);
          endIncomingIdList.forEach(incomingId => {
            dpn.addArc(incomingId, endId);
          });
          dpn.addArcToEndTransition(endId);
          break;
        case 'bpmn:ExclusiveGateway':
          const exclusiveId = flowElement.id
          const exclusiveName = flowElement.name ?? null;

          const exclusiveIncomingIdList = flowToId(flowElement.incoming);
          const exclusiveOutgoingIdList = flowToId(flowElement.outgoing);
          const i = 0;
          const guardsForGateway = gateGuardMap.get(exclusiveId);
          if (exclusiveIncomingIdList.length == 1 && exclusiveOutgoingIdList.length > 1) {
            if (guardsForGateway == undefined) {
              throw new Error("There isn't added gaurd to the exclusive gateway: " + exclusiveName);
            }

            const inputPlaceId = exclusiveIncomingIdList[0];

            exclusiveOutgoingIdList.forEach((outgoingFlowId, index) => {
              const guard = findGuardForSequenceFlow(guardsForGateway, outgoingFlowId);

              if (guard === undefined) {
                throw new Error(
                  'Missing guard for outgoing sequence flow "' +
                  outgoingFlowId +
                  '" on exclusive gateway "' +
                  exclusiveName +
                  '".',
                );
              }

              const transitionId = exclusiveId + "_" + index;

              dpn.addTransition(
                transitionId,
                null,
                Gateway.Exclusive,
                guard.pre,
              );

              dpn.addArc(inputPlaceId, transitionId);
              dpn.addArc(transitionId, outgoingFlowId);
            });

          } else if (exclusiveIncomingIdList.length > 1 && exclusiveOutgoingIdList.length == 1) {
            const outputPlaceId = exclusiveOutgoingIdList[0];

            exclusiveIncomingIdList.forEach((incomingFlowId, index) => {
              const transitionId = exclusiveId + "_" + index;

              dpn.addTransition(
                transitionId,
                null,
                Gateway.Exclusive,
                null,
              );

              dpn.addArc(incomingFlowId, transitionId);
              dpn.addArc(transitionId, outputPlaceId);
            });

          } else {
            throw new Error(
              'Unsupported exclusive gateway shape for "' +
              exclusiveName +
              '". It has ' +
              exclusiveIncomingIdList.length +
              ' incoming and ' +
              exclusiveOutgoingIdList.length +
              ' outgoing sequence flows.',
            );
          }

          break;
        case 'bpmn:ParallelGateway':
          const parallelId = flowElement.id
          const parallelName = flowElement.name ?? null;
          dpn.addTransition(parallelId, parallelName);

          const parallelIncomingIdList = flowToId(flowElement.incoming);
          parallelIncomingIdList.forEach(incomingId => {
            dpn.addArc(incomingId, parallelId);
          });

          const parallelOutgoingIdList = flowToId(flowElement.outgoing);
          parallelOutgoingIdList.forEach(outgoingId => {
            dpn.addArc(parallelId, outgoingId);
          });
          break;
        default:
          break;
      }
    });

  });

  return dpn;
}

function flowToId(flowList: Array<any>): Array<string> {
  let idList: Array<string> = [];
  if (flowList) {
    flowList.forEach(flow => {
      idList.push(flow.id);
    });
  }
  return idList;
}

function findGuardForSequenceFlow(
  guards: GateGuards[],
  sequenceFlowId: string,
): GateGuards | undefined {
  return guards.find(guard => guard.arcId === sequenceFlowId);
}

export { bpmnToPn };