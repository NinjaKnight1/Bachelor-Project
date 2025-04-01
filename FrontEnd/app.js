import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import DmnModeler from 'dmn-js/lib/Modeler';
import DmnModdle from 'dmn-moddle';
import { is } from 'bpmn-js/lib/util/ModelUtil'; // Utility to check element type


// BPMN and DMN diagram XML files
import bpmnDiagramXML from '../resources/defaultBpmnDiagram.bpmn';
import dmnDiagramXML from '../resources/defaultDmnDiagram.dmn';


// At the top level, create a moddle instance (once).
const dmnModdle = new DmnModdle();

let activeTaskId = null;

let bpmnModeler;
let dmnModeler;

async function init() {

  bpmnModeler = new BpmnModeler({
    container: '#bpmn-canvas',
  });
  dmnModeler = new DmnModeler({
    container: '#dmn-canvas',
  });

  await openDiagramBPMN(bpmnDiagramXML);
  await openDiagramDMN(dmnDiagramXML);

  rightClickOnBPMN();

  // Add event listener to the button
  document.getElementById("export-button").addEventListener("click", exportAndConvert);
  document.getElementById("dmn-back-button").addEventListener("click", goBackToBpmn);
}

async function openDiagramDMN(xml) {
  try {
    await dmnModeler.importXML(xml);
    console.log("DMN loaded.");
  } catch (err) {
    console.error('Error loading DMN diagram:', err);
  }
}

async function openDiagramBPMN(xml) {
  try {
    await bpmnModeler.importXML(xml);
    console.log("BPMN loaded.");
  } catch (err) {
    console.error('Error loading BPMN diagram:', err);
  }
}


// Function to convert BPMN to Petri Net
async function convertBPMNToPetriNet(file) {

  if (!bpmnModeler) {
    alert("BPMN Modeler not initialized!");
    return;
  }
  const formData = new FormData();
  formData.append("file", file, "diagram.bpmn");

  try {
    const response = await fetch("http://localhost:8080/convert/",
      {
        method: "POST",
        body: formData,
        headers: { "Accept": "application/json" }
      });


    if (!response.ok) {
      throw new Error("Failed to convert BPMN to Petri Net");
    }

    const data = await response.json();
    console.log("Conversion successful:", data);
    alert("BPMN successfully converted to Petri Net!");
  } catch (error) {
    console.error("Error converting BPMN:", error);
    alert("Conversion failed. Check the console for details.");
  }
}

function rightClickOnBPMN() {
  // Add event listener for right-click (context menu) on elements
  bpmnModeler.on('element.contextmenu', function (event) {
    event.originalEvent.preventDefault(); // Prevent the default browser context menu
    const element = event.element;

    // Check if the right-clicked element is a BPMN Task
    if (is(element, 'bpmn:Task')) {
      const taskBusinessObject = element.businessObject;
      taskBusinessObject.dmnDecisionRef = element.id;

      openTableFromTaskID(element.id);
      activeTaskId = element.id;
      console.log('Task element right-clicked:', element);
      // alert(`Right-clicked on Task: ${element.id}`);
    } else {
      console.log('Right-clicked on non-task element:', element);
    }
  });
}

// Function to save the BPMN diagram as XML and trigger conversion
async function exportAndConvert() {
  try {
    const { xml } = await bpmnModeler.saveXML({ format: true });

    // Convert XML string to a file and send it to the backend
    const file = new File([xml], "diagram.bpmn", { type: "text/xml" });
    await convertBPMNToPetriNet(file);

  } catch (error) {
    console.error("Error exporting BPMN:", error);
    alert("Failed to export BPMN. Check the console for details.");
  }
}


async function openTableFromTaskID(decisionId) {
  // 1) See if the DMN file has a <decision id="Task_1"> already
  // await openDiagramDMN(dmnDiagramXML);

  // 3) Switch the UI from BPMN view to DMN view
  document.getElementById('bpmn-container').style.display = 'none';
  document.getElementById('dmn-container').style.display = 'block';

  // 4) Show that decision's table
  // dmnModeler.showDecision(decisionId);
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

async function goBackToBpmn() {
  try {
    // 1) Get the current definitions from the active DMN viewer
    // const dmnViewer = dmnModeler.getActiveViewer();
    // const definitions = dmnJS.getDefinitions();
    const { xml: updatedDmnXml } = await dmnModeler.saveXML({ format: true });

    // 2) Convert the updated definitions object to XML
    // const moddle = dmnModeler.get('dmnModdle');
    // const { xml: updatedDmnXml } = await moddle.toXML(definitions);

    // 3) (Optional) Re-import to ensure the DMN modeler stays in sync, 
    //    though if you immediately hide the DMN and don't plan to keep editing, 
    //    you could skip the re-import:
    await dmnModeler.importXML(updatedDmnXml);

    // 4) Switch UI: hide DMN container, show BPMN container
    document.getElementById('dmn-container').style.display = 'none';
    document.getElementById('bpmn-container').style.display = 'block';

    // 5) Clear any "active task" references if you have them
    activeTaskId = null;
  } catch (err) {
    console.error('Error saving DMN:', err);
    alert('Failed to save DMN. Check the console for details.');
  }
}


init();