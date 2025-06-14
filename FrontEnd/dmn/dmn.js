import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';

import { dmnModeler } from '../app.js';


export async function OLDopenTableFromTaskID(dmnModeler, decisionId) {

    // 1) See if the DMN file has a <decision id="Task_1"> already
    // await openDiagramDMN(dmnDiagramXML);
    dmnModeler.on('views.changed', function (event) {
        console.log("Views changed event:", event);
    });
    // 3) Switch the UI from BPMN view to DMN view

    const allViews = dmnModeler.getViews();

    const activeViewer = dmnModeler.getActiveViewer();
    // let views = dmnModeler._getViewProviders().opens();
    console.log("activeViewer", activeViewer);
    console.log("dmn modeler", dmnModeler);
    // console.log("views", views);
    console.log("activeViewer getmodules", activeViewer.getModules());
    const viewdrd = activeViewer.get('viewDrd');
    console.log("viewdrd", viewdrd);

    if (!activeViewer) {
        console.error("No active viewer found.");
        return;
    }

    // 3) See if the DMN has a <decision> with the ID
    const existingView = findDecisionView(decisionId);
    console.log("existingViews ", existingView);

    // 4) If no existing decision, create one
    if (!existingView) {
        await createNewDecision(decisionId);

        // Re-check after creation
        let newView = findDecisionView(decisionId);
        if (newView) {
            console.log("New decision created:", newView);
            dmnModeler.open(newView);
        } else {
            console.error("Failed to create new decision:", decisionId);
            return;
        }
    } else {
        // If it exists, just show it
        dmnModeler.open(existingView);
    }
    document.getElementById('bpmn-container').style.display = 'none';
    document.getElementById('dmn-container').style.display = 'block';


}


export async function openTableFromTaskID(dmnModeler, decisionId, dmnDicisionTableName) {
    const activeViewer = dmnModeler.getActiveViewer();

    if (!activeViewer) {
        console.error("No active viewer found.");
        return;
    }
    const existingView = findDecisionView(decisionId);

    if (!existingView) {
        createNewDecision(decisionId, dmnDicisionTableName);

        let newView = findDecisionView(decisionId);
        if (newView) {
            console.log("New decision created:", newView);
            // Open the new decision view, which is a decision table
            dmnModeler.open(newView);
        } else {
            console.error("Failed to create new decision:", decisionId);
            return;
        }
    } else {
        // Open the new decision view, which is a decision table
        dmnModeler.open(existingView);
    }
    // Hiding the BPMN div and showing the DMN div
    document.getElementById('bpmn-container').style.display = 'none';
    document.getElementById('dmn-container').style.display = 'block';


}

// Function to find the view 
function findDecisionView(decisionId) {
    if (!dmnModeler.getActiveViewer()) {
        return null;
    }
    const allViews = dmnModeler.getViews();
    return allViews.find(view => view.element.id === decisionId);
}


function createNewDecision(decisionId, dmnDicisionTableName) {
    let dmnModdle = dmnModeler._moddle;
    let definitions = dmnModeler.getDefinitions();

    const newDecision = dmnModdle.create('dmn:Decision', {
        id: decisionId,
        name: dmnDicisionTableName,
    });

    const newDecisionTable = dmnModdle.create('dmn:DecisionTable', {
        id: `${decisionId}_decisionTable`,
        hitPolicy: 'UNIQUE'
    });

    const inputClause = dmnModdle.create('dmn:InputClause', {
        id: `${decisionId}_inputClause`
    });

    const inputExpression = dmnModdle.create('dmn:LiteralExpression', {
        id: `${decisionId}_inputExpression`,
        text: '',
        typeRef: 'string'
    });

    inputClause.inputExpression = inputExpression;

    const outputClause = dmnModdle.create('dmn:OutputClause', {
        id: `${decisionId}_outputClause`,
        typeRef: 'string'
    });

    newDecisionTable.input = [inputClause];
    newDecisionTable.output = [outputClause];

    newDecisionTable.$parent = newDecision;
    inputClause.$parent = newDecisionTable;
    outputClause.$parent = newDecisionTable;
    inputExpression.$parent = inputClause;
    newDecision.$parent = definitions;
    newDecision.decisionLogic = newDecisionTable;

    definitions.drgElement.push(newDecision);

    dmnModeler._setDefinitions(definitions);

}

function evaluateDecision() {
    const inputValue = document.getElementById('dmnInputField').value;
    const viewer = dmnModeler.getActiveViewer();
    const decision = viewer.getDecision(); // get the current decision

    viewer.getDecisionService().evaluate(decision.id, {
        'yourInputVariableName': inputValue
    }).then(result => {
        console.log("Evaluation result:", result);
    }).catch(err => {
        console.error("Evaluation failed", err);
    });
}

window.evaluateDecision = evaluateDecision;