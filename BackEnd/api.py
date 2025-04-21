import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pm4py
from pm4py.visualization.petri_net import visualizer as pn_vis_factory

from replace import split_pnml_element
from sortBusinessTask import business_task_list

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
    dmn: UploadFile = File(None)  # Optional DMN file
):
    try:
        # Save BPMN
        bpmn_path = os.path.join(PETRI_NETS_DIR, bpmn.filename)
        with open(bpmn_path, "wb") as f:
            f.write(await bpmn.read())
        print(f"BPMN saved at: {bpmn_path}")

        # Save DMN (if provided)
        if dmn:
            dmn_path = os.path.join(PETRI_NETS_DIR, dmn.filename)
            with open(dmn_path, "wb") as f:
                f.write(await dmn.read())
            print(f"DMN saved at: {dmn_path}")

        # Read BPMN model from saved file
        bpmn_model = pm4py.read_bpmn(bpmn_path)

        # Convert BPMN to Petri Net
        petri_net, im, fm = pm4py.convert_to_petri_net(bpmn_model)

        # Export the Petri net to PNML using the exporter
        pm4py.write_pnml(petri_net, im, fm, bpmn_path.replace(".bpmn", ".pnml"))

        # Read the PNML file
        pnml_file_path = bpmn_path.replace(".bpmn", ".pnml")


        # Determine the execution order of the PNML file
        businessT_list = business_task_list(bpmn_path, dmn_path)
        print("BusinessTask List and Number:", businessT_list)
   
        for activity in businessT_list:
            # Activity is a tuple (task_id, num, rules)
            task_id, rules = activity

            print(f"Splitting element with ID: {task_id} into {len(rules)} elements.")

            split_pnml_element(
                pnml_path=pnml_file_path,    # Path to the PNML file
                element_id=task_id,          # The ID of the transition to split
                rules=rules,                 # Rules for the task
                output_path=pnml_file_path   # Output file path
            )
            print(f"Element {activity} split into 2 new elements.")

        # Read the modified PNML file
        modified_petri_net, im, fm = pm4py.read_pnml(pnml_file_path)

        # Convert the Petri Net to a DiGraph
        # Visualize the Petri Net and save the diagram
        gviz = pn_vis_factory.apply(modified_petri_net, im, fm)
        diagram_path = pnml_file_path.replace(".pnml", ".png")
        pn_vis_factory.save(gviz, diagram_path)

        return {"message": "Conversion successful!", "file_path": bpmn_path}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
