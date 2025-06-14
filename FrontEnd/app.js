import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import { openTableFromTaskID } from './dmn/dmn.js';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import DmnModeler from 'dmn-js/lib/Modeler';
import DmnModdle from 'dmn-moddle';
import { is } from 'bpmn-js/lib/util/ModelUtil'; // Utility to check element type

// BPMN and DMN diagram XML files
import bpmnDiagramXML from '/resources/defaultBpmnDiagram.bpmn';
import dmnDiagramXML from '/resources/defaultDmnDiagram.dmn';
import './CSS/style.css';
import CustomPaletteProvider from './bpmn/customPaletteProvider.js';
import { jsonFromBpmnAndDmn } from './translationOfFeel.ts';
import { TranslationError } from './customErrors.ts';

// At the top level, create a moddle instance (once).
export const dmnModdle = new DmnModdle();

let activeTaskId = null;

let bpmnModeler;
export let dmnModeler;

const models = {
  default: {
    bpmn: '/resources/defaultBpmnDiagram.bpmn',
    dmn: '/resources/defaultDmnDiagram.dmn',
  },
  takeaway: {
    bpmn: '/Diagrams/Report_Example/diagram.bpmn',
    dmn: '/Diagrams/Report_Example/decision-table.dmn',
  },
  parallel: {
    bpmn: '/Diagrams/Parallel_Example/diagram.bpmn',
    dmn: '/Diagrams/Parallel_Example/decision-table.dmn',
  }
}


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
  // on BPMN div
  document.getElementById("export-button").addEventListener("click", exportAndConvert);

  document.getElementById('import-bpmn').addEventListener("change", handleFileUpload);
  document.getElementById('import-dmn').addEventListener("change", handleFileUpload);
  document.getElementById('download-button').addEventListener("click", handleDownload);

  document.getElementById('select-model').addEventListener('change', handleModelChange);

  // on DMN div
  document.getElementById("dmn-back-button").addEventListener("click", () => goBackToBpmn(dmnModeler));
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

// Handles the import of files and changes the diagram for dmn or bpmn to the uploaded file
async function handleFileUpload(htmlElement) {
  const file = htmlElement.target.files[0];
  // if the user have not uploaded a file
  if (!file) {
    return;
  }

  try {
    let extension = file.name.substring(file.name.lastIndexOf('.') + 1, file.name.length) || undefined;

    const xml = await file.text();

    switch (extension) {
      case 'bpmn':
        await openDiagramBPMN(xml);
        break;

      case 'dmn':
        await openDiagramDMN(xml);
        break;

      default:
        // This shouldn't be able to happen as there are type checks in <input>
        alert("The file type ." + extension + " is not supportet");
        break;
    }
  } catch (error) {
    console.error(error);
    alert("Failed to load diagram, try again");
  } finally {
    htmlElement.target.value = '';
  }
}

async function handleDownload() {
  console.log("hej");
  try {
    const { xml: bpmnXml } = await bpmnModeler.saveXML({ format: true });
    const { xml: dmnXml } = await dmnModeler.saveXML({ format: true });

    downloadXML("Business Process Diagram.bpmn", bpmnXml);
    downloadXML("Decision Tables.dmn", dmnXml);


  } catch (error) {
    console.error(error);
    alert("Failed to download diagram, try again");
  }
}

async function handleModelChange(htmlElement) {
  const key = htmlElement.target.value;

  // There haven't been picked any model version
  if (!key) {
    return;
  }
  const { bpmn, dmn } = models[key];
  try {

    const [bpmnXml, dmnXml] = await Promise.all([
      fetch(bpmn).then(r => r.text()),
      fetch(dmn).then(r => r.text())
    ]);

    await openDiagramBPMN(bpmnXml);
    await openDiagramDMN(dmnXml);

  } catch (error) {
    console.error(error);
    alert("Failed to load model, try again");
  } finally {
    htmlElement.target.value = '';
  }
}

function downloadXML(fileName, xml) {
  const blob = new Blob([xml], { type: 'application/xml' });
  let url = URL.createObjectURL(blob);

  const elementA = document.createElement('a')
  elementA.href = url;
  elementA.download = fileName;

  // download the file
  elementA.click();
  elementA.remove();

  URL.revokeObjectURL(url);
}

async function downloadURL(fileName, url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error("download failed", resp.statusText);
    return;
  }
  const blob    = await resp.blob();
  const blobURL = URL.createObjectURL(blob);
  const elementA = document.createElement('a')
  elementA.href = blobURL;
  elementA.download = fileName;

  // download the file
  elementA.click();
  elementA.remove();

  URL.revokeObjectURL(url);
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
    const response = await fetch("http://localhost:8081/convert/",
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

    let diagramDecisionJsonFile = await jsonFromBpmnAndDmn(bpmnModeler, dmnModeler);
    if (!diagramDecisionJsonFile) {
      throw new Error("Failed to convert BPMN and DMN");
    }


    // Send both files to backend
    const formData = new FormData();
    formData.append("bpmn", bpmnFile);
    formData.append("dmn", dmnFile);
    formData.append("json", diagramDecisionJsonFile);

    const response = await fetch("http://localhost:8081/convert/", {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to convert BPMN and DMN");
    }

    const data = await response.json();
    let pnmlUrl = "http://localhost:8081" + data.pnml_url;
    let pngUrl = "http://localhost:8081" + data.image_url;
    // document.getElementById("petri-img").src = `http://localhost:8081${png_url}`;
    await downloadURL("diagram.pnml", pnmlUrl);
    await downloadURL("DPNImage.png", pngUrl);
    console.log("Conversion successful:", data);
    alert("BPMN and DMN successfully converted and saved!");
  } catch (error) {
    if (error instanceof TranslationError) {
      console.log(error);
      alert("Translation failed. Check the console for details.");
    }
    console.error("Error exporting BPMN/DMN:", error);
    alert("Export or conversion failed. Check the console for details.");
  }
}


export async function goBackToBpmn() {
  try {
    const { xml: updatedDmnXml } = await dmnModeler.saveXML({ format: true });
    await dmnModeler.importXML(updatedDmnXml);

    document.getElementById('dmn-container').style.display = 'none';
    document.getElementById('bpmn-container').style.display = 'block';

    activeTaskId = null;
  } catch (err) {
    console.error('Error saving DMN:', err);
    alert('Failed to save DMN. Check the console for details.');
  }
}


init();