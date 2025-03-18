import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import diagramXML from '../resources/newDiagram.bpmn';

const modeler = new BpmnModeler({
  container: '#bpmn-canvas',
});

async function openDiagram(xml) {
  try {
    await modeler.importXML(xml);
  } catch (err) {
    console.error('Error loading BPMN diagram:', err);
  }
}

await openDiagram(diagramXML);

// Function to convert BPMN to Petri Net
async function convertBPMNToPetriNet(file) {

  if (!modeler) {
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

// Function to save the BPMN diagram as XML and trigger conversion
async function exportAndConvert() {
  try {
    const { xml } = await modeler.saveXML({ format: true });

    // Convert XML string to a file and send it to the backend
    const file = new File([xml], "diagram.bpmn", { type: "text/xml" });
    await convertBPMNToPetriNet(file);

  } catch (error) {
    console.error("Error exporting BPMN:", error);
    alert("Failed to export BPMN. Check the console for details.");
  }
}

// Add event listener to the button
document.getElementById("export-button").addEventListener("click", exportAndConvert);
