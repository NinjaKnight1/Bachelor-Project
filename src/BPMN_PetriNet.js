// Code to convert BPMN to Petri Net (using bpmn-dpn/api.py)
async function convertBPMNToPetriNet(file) {
    const formData = new FormData();
    formData.append("file", file);
  
    const response = await fetch("http://localhost:8000/convert/", {
        method: "POST",
        body: formData
    });
  
    const data = await response.json();
    console.log(data);
  }