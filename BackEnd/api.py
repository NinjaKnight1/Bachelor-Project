import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pm4py
from pm4py.visualization.petri_net import visualizer as pn_vis_factory

from replace import split_pnml_element, split_gateway
from json_mani import business_task_list_json, _Xor_gatewayRules

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the 'petri_nets' directory exists
PETRI_NETS_DIR = "petri_nets"
os.makedirs(PETRI_NETS_DIR, exist_ok=True)

@app.post("/convert/")
async def convert_bpmn(
    bpmn: UploadFile = File(...),
    dmn: UploadFile = File(None),  # Optional DMN file
    #json files
    json: UploadFile = File(None)  # Optional JSON file for DMN rules
    ):

    try:
        # Save BPMN
        bpmn_path = os.path.join(PETRI_NETS_DIR, bpmn.filename)
        with open(bpmn_path, "wb") as f:
            f.write(await bpmn.read())
        print(f"BPMN saved at: {bpmn_path}")

        dmn_path = os.path.join(PETRI_NETS_DIR, dmn.filename)
        with open(dmn_path, "wb") as f:
            f.write(await dmn.read())
        print(f"BPMN saved at: {dmn_path}")

        # Save json
        if json:
            json_path = os.path.join(PETRI_NETS_DIR, json.filename)
            with open(json_path, "wb") as f:
                f.write(await json.read())
            print(f"JSON saved at: {json_path}")
        else:
            json_path = None
            print("No JSON file provided.")

    
        # Read BPMN model from saved file
        bpmn_model = pm4py.read_bpmn(bpmn_path)

        # Convert BPMN to Petri Net
        petri_net, im, fm = pm4py.convert_to_petri_net(bpmn_model)

        # Export the Petri net to PNML using the exporter
        pm4py.write_pnml(petri_net, im, fm, bpmn_path.replace(".bpmn", ".pnml"))

        # Read the PNML file
        pnml_file_path = bpmn_path.replace(".bpmn", ".pnml")

        json_path = "petri_nets/diagramDecisions.json"  # Path to the DMN JSON file


        # Determine the execution order of the PNML file
        businessT_list = business_task_list_json(bpmn_path, json_path)
        XorGateway_list = _Xor_gatewayRules(json_path)

        for activity in XorGateway_list:
            # Activity is a tuple (task_id, [(pre, target), ...])
            task_id, rules = activity

            print(f"Splitting element with ID: {task_id} into {len(rules)} elements.")

            split_gateway(
                pnml_path=pnml_file_path,    # Path to the PNML file
                element_id=task_id,          # The ID of the transition to split
                rules=rules,                 # Rules for the task
                output_path=pnml_file_path   # Output file path
            )
        print("Xor Gateway split successfully.")


        for activity in businessT_list:
            # Activity is a tuple ((task_id, [(pre, post), ...]),...)
            task_id, rules = activity
            
            split_pnml_element(
                pnml_path=pnml_file_path,    # Path to the PNML file
                element_id=task_id,          # The ID of the transition to split
                rules=rules,                 # Rules for the task
                output_path=pnml_file_path   # Output file path
            )
            
        print("PNML file modified successfully.")

        # Read the modified PNML file
        modified_petri_net, im, fm = pm4py.read_pnml(pnml_file_path)

        # Convert the Petri Net to a DiGraph
        # Visualize the Petri Net and save the diagram
        gviz = pn_vis_factory.apply(modified_petri_net, im, fm)
        diagram_path = pnml_file_path.replace(".pnml", ".png")
        pn_vis_factory.save(gviz, diagram_path)

            
        return {
        "message": "Conversion successful!", "file_path": bpmn_path,
        # relative URLs that the front-end can fetch
        "pnml_url":  f"{pnml_file_path}",
        "image_url": f"{diagram_path}"
        }


    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
