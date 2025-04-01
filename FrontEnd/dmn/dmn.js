import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';

import { dmnModeler } from '../app.js';
import { dmnModdle } from '../app.js';


export async function openTableFromTaskID(dmnModeler, decisionId) {
    // 1) See if the DMN file has a <decision id="Task_1"> already
    // await openDiagramDMN(dmnDiagramXML);

    // 3) Switch the UI from BPMN view to DMN view
    document.getElementById('bpmn-container').style.display = 'none';
    document.getElementById('dmn-container').style.display = 'block';

    // 4) Show that decision's table
    dmnModeler.once('views.changed', async function handleDMNViewChanged() {

        // 2a) Check if we have an active viewer
        const activeViewer = dmnModeler.getActiveViewer?.();
        if (!activeViewer) {
            return;
        }

        // 3) See if the DMN has a <decision> with the ID
        const existingView = findDecisionView(decisionId);

        // 4) If no existing decision, create one
        if (!existingView) {
            await createNewDecision(decisionId);

            // Re-check after creation
            const newlyCreatedView = findDecisionView(decisionId);
            if (newlyCreatedView) {
                dmnModeler.showDecision(decisionId);
            }
        } else {
            // If it exists, just show it
            dmnModeler.showDecision(decisionId);
        }
    });
}


function findDecisionView(decisionId) {
    if (!dmnModeler.getActiveViewer()) {
        return null;
    }
    const allViews = dmnModeler.getViews?.() || [];
    return allViews.find(view => view.element?.id === decisionId);
}


async function createNewDecision(decisionId) {

    // 1) Save the current DMN as XML
    const { xml: oldXml } = await dmnModeler.saveXML({ format: true });

    // 2) Parse it using our own dmnModdle instance
    const { rootElement: definitions } = await dmnModdle.fromXML(oldXml);

    // 3) Create your new Decision + DecisionTable
    const newDecision = dmnModdle.create('dmn:Decision', {
        id: decisionId,
        name: decisionId
    });

    const newDecisionTable = dmnModdle.create('dmn:DecisionTable', {
        id: `DecisionTable_${decisionId}`,
        hitPolicy: 'UNIQUE'
    });

    const inputClause = dmnModdle.create('dmn:InputClause', {
        id: `${decisionId}_inputClause`
    });
    const inputExpression = dmnModdle.create('dmn:LiteralExpression', {
        id: `${decisionId}_inputExpression`,
        text: 'inputVar',
        typeRef: 'string'
    });
    inputClause.inputExpression = inputExpression;

    const outputClause = dmnModdle.create('dmn:OutputClause', {
        id: `${decisionId}_outputClause`,
        typeRef: 'string'
    });

    newDecisionTable.input = [inputClause];
    newDecisionTable.output = [outputClause];
    newDecision.decisionTable = newDecisionTable;

    // 4) Push to definitions.drgElement
    definitions.drgElement = definitions.drgElement || [];
    definitions.drgElement.push(newDecision);

    // 5) Convert definitions -> updated XML
    const { xml: newXml } = await dmnModdle.toXML(definitions, { format: true });

    // 6) Re-import into dmnModeler
    await dmnModeler.importXML(newXml);
}

