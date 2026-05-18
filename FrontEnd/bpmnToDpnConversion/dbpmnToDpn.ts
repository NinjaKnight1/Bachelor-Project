import BpmnModeler from 'bpmn-js/lib/Modeler';
import { DPN } from './dpn';

function bpmnToPn(bpmnModeler: BpmnModeler): DPN {
  let dpn = new DPN();

  let definitions = bpmnModeler.getDefinitions()
  console.log(definitions);
  let diagramList = definitions.diagrams;
  diagramList.forEach((diagram: any) => {
    let plane = diagram.plane;
    let bpmnElement = plane.bpmnElement;
    let flowElementList = bpmnElement.flowElements;
    let artifactList = bpmnElement.artifacts;
    console.log(typeof flowElementList);
    console.log(flowElementList);

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
        case 'bpmn:BusinessRuleTask':
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
          if (exclusiveIncomingIdList.length == 1 && exclusiveOutgoingIdList.length > 1) {
            // dpn.addTransition()
          } else if (exclusiveIncomingIdList.length > 1 && exclusiveOutgoingIdList.length == 1) {
            
          } else {
            // Should this be possible 
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
          console.log(flowElement.$type);
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

export { bpmnToPn };