import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import { openTableFromTaskID } from'./dmn/dmn.js';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import DmnModeler from 'dmn-js/lib/Modeler';
import DmnModdle from 'dmn-moddle';
import { is } from 'bpmn-js/lib/util/ModelUtil'; // Utility to check element type

// BPMN and DMN diagram XML files
import bpmnDiagramXML from '../resources/defaultBpmnDiagram.bpmn';
import dmnDiagramXML from '../resources/defaultDmnDiagram.dmn';
import './CSS/style.css';
import CustomPaletteProvider from './bpmn/customPaletteProvider.js';

// At the top level, create a moddle instance (once).
export const dmnModdle = new DmnModdle();

let activeTaskId = null;

let bpmnModeler;
export let dmnModeler;

async function init() {

  bpmnModeler = new BpmnModeler({
    container: '#bpmn-canvas',
    additionalModules: [
      CustomPaletteProvider
    ],
  });

  dmnModeler = new DmnModeler({
    container: '#dmn-canvas',
    decisionTable: {
      additionalModules: [
        {
          viewDrd: ['value', null]
        }
      ]
    },
  });

  await openDiagramBPMN(bpmnDiagramXML);
  await openDiagramDMN(dmnDiagramXML);

  rightClickOnBPMN();

  // Add event listener to the button
  document.getElementById("export-button").addEventListener("click", exportAndConvert);
  document.getElementById("dmn-back-button").addEventListener("click", () => goBackToBpmn(dmnModeler));}

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
    if (is(element, 'bpmn:BusinessRuleTask')) {
      const taskBusinessObject = element.businessObject;
      taskBusinessObject.dmnDecisionRef = element.id;

      // Giv the name of the bpmn task so if the dmn decision table is not made yet, it will be created with the same name as the bpmn task
      let dmnDicisionTableName = taskBusinessObject.name
      // If the bpmn task has no name, the dmn decision table will be created with the name "Decision table"
      dmnDicisionTableName ??= "Decision table";
      
      // Pass dmnModeler as the first argument
      openTableFromTaskID(dmnModeler, element.id, dmnDicisionTableName);
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
    // Export BPMN XML
    const { xml: bpmnXml } = await bpmnModeler.saveXML({ format: true });
    const bpmnFile = new File([bpmnXml], "diagram.bpmn", { type: "text/xml" });

    // Export DMN XML
    const { xml: dmnXml } = await dmnModeler.saveXML({ format: true });
    const dmnFile = new File([dmnXml], "decision-table.dmn", { type: "text/xml" });

    // Send both files to backend
    const formData = new FormData();
    formData.append("bpmn", bpmnFile);
    formData.append("dmn", dmnFile);

    const response = await fetch("http://localhost:8080/convert/", {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to convert BPMN and DMN");
    }

    const data = await response.json();
    console.log("Conversion successful:", data);
    alert("BPMN and DMN successfully converted and saved!");
  } catch (error) {
    console.error("Error exporting BPMN/DMN:", error);
    alert("Export or conversion failed. Check the console for details.");
  }
}


export async function goBackToBpmn() {
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