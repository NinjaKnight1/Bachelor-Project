import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pm4py
from pm4py.visualization.petri_net import visualizer as pn_vis_factory
import sys
import runpy
import io
import contextlib
import tempfile

from replace import split_pnml_element, split_gateway, add_variables_from_json_to_pnml, set_ada_markings
from json_mani import business_task_list_json, _Xor_gatewayRules

from pathlib import Path
from fastapi.staticfiles import StaticFiles


class SoundnessRequest(BaseModel):
    pnml_xml: str
    file_name: str = "diagram.pnml"


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
app.mount("/files", StaticFiles(directory=PETRI_NETS_DIR), name="files")


# Path to the `ada` script folder. Can be overridden with env var `ADA_SRC_PATH`.
DEFAULT_ADA_SRC = "/Users/HannahTersbol/Desktop/Bachelor/ada/src"
ADA_SRC_PATH = os.environ.get("ADA_SRC_PATH", DEFAULT_ADA_SRC)


def run_ada_script(args: list[str]):
    """Run ada.py as a script with given argv list and capture stdout/stderr.

    Returns a dict: {"stdout","stderr","return_code","exception"}
    """
    ada_py = os.path.join(ADA_SRC_PATH, "ada.py")
    if not os.path.isfile(ada_py):
        raise FileNotFoundError(f"ada.py not found at {ada_py}")

    # Backup argv, sys.path, and working directory
    old_argv = sys.argv[:]
    old_sys_path = sys.path[:]
    old_cwd = os.getcwd()
    
    ada_root = os.path.dirname(ADA_SRC_PATH)
    sys.path.insert(0, ADA_SRC_PATH)
    if ada_root not in sys.path:
        sys.path.insert(0, ada_root)
    sys.argv = [ada_py] + list(args)
    
    # Change to ADA root directory so relative paths work
    os.chdir(ada_root)

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    result = {"stdout": "", "stderr": "", "return_code": 0, "exception": None}

    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            try:
                runpy.run_path(ada_py, run_name="__main__")
            except SystemExit as se:
                # Capture explicit sys.exit calls
                try:
                    result["return_code"] = int(se.code) if se.code is not None else 0
                except Exception:
                    result["return_code"] = 0
    except Exception as e:
        result["exception"] = repr(e)
        result["return_code"] = 1
    finally:
        result["stdout"] = stdout_buf.getvalue()
        result["stderr"] = stderr_buf.getvalue()
        # restore argv, path, and working directory
        sys.argv = old_argv
        sys.path = old_sys_path
        os.chdir(old_cwd)

    return result


def check_pnml_soundness(pnml_file: str) -> bool:
    """
    Check if a PNML file is data-aware sound using ADA.
    """
    if not os.path.isfile(pnml_file):
        raise FileNotFoundError(f"PNML file not found: {pnml_file}")
    
    result = run_ada_script(["-m", pnml_file, "-s"])
    
    if result["exception"]:
        raise Exception(f"ADA soundness check failed: {result['exception']}")
    
    # Parse output to determine soundness
    # ADA prints: "<name> is data-aware sound" or "<name> is not data-aware sound"
    stdout = result["stdout"]
    stderr = result["stderr"]
    output = stdout + stderr
    
    # Check if the output indicates the model is sound
    is_sound = "is data-aware sound" in output and "is not data-aware sound" not in output
    
    return is_sound


@app.post("/convert/")
async def convert_bpmn(
    bpmn: UploadFile = File(...),
    dmn: UploadFile = File(None),  # Optional DMN file
    # json files
    json: UploadFile = File(None),  # Optional JSON file for DMN rules
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

        # base, _ = os.path.splitext(pnml_file_path)
        # diagram_path = base + ".png"

        # gviz = pn_vis_factory.apply(petri_net, im, fm)
        # pn_vis_factory.save(gviz, diagram_path)

        # print(f"PNML saved at: {pnml_file_path}")
        # print(f"Image saved at: {diagram_path}")
        # print(f"PNML exists: {os.path.exists(pnml_file_path)}")
        # print(f"Image exists: {os.path.exists(diagram_path)}")

        # return {
        #     "message": "Conversion successful!",
        #     # "file_path": bpmn_path,
        #     # relative URLs that the front-end can fetch
        #     "pnml_url": f"/files/{Path(pnml_file_path).name}",
        #     "image_url": f"/files/{Path(diagram_path).name}"
        # }

        json_path = "petri_nets/diagramDecisions.json"  # Path to the DMN JSON file

        # Determine the execution order of the PNML file
        businessT_list = business_task_list_json(bpmn_path, json_path)
        XorGateway_list = _Xor_gatewayRules(json_path)

        for activity in XorGateway_list:
            # Activity is a tuple (task_id, [(pre, target), ...])
            task_id, rules = activity

            print(f"Splitting element with ID: {task_id} into {len(rules)} elements.")

            split_gateway(
                pnml_path=pnml_file_path,  # Path to the PNML file
                element_id=task_id,  # The ID of the transition to split
                rules=rules,  # Rules for the task
                output_path=pnml_file_path,  # Output file path
            )
        print("Xor Gateway split successfully.")

        for activity in businessT_list:
            # Activity is a tuple ((task_id, [(pre, post), ...]),...)
            task_id, rules = activity

            split_pnml_element(
                pnml_path=pnml_file_path,  # Path to the PNML file
                element_id=task_id,  # The ID of the transition to split
                rules=rules,  # Rules for the task
                output_path=pnml_file_path,  # Output file path
            )

        print("PNML file modified successfully.")

        add_variables_from_json_to_pnml(
            pnml_path=pnml_file_path,
            json_path=json_path,
            output_path=pnml_file_path,
        )

        set_ada_markings(
            pnml_path=pnml_file_path,
            output_path=pnml_file_path,
            start_place_id="source",
            final_place_id="sink",
        )
        print("PNML variables added successfully.")

        # Read the modified PNML file
        modified_petri_net, im, fm = pm4py.read_pnml(pnml_file_path)

        # Convert the Petri Net to a DiGraph
        # Visualize the Petri Net and save the diagram
        gviz = pn_vis_factory.apply(modified_petri_net, im, fm)
        base, _ = os.path.splitext(pnml_file_path)
        diagram_path = base + ".png"
        pn_vis_factory.save(gviz, diagram_path)

        return {
            "message": "Conversion successful!",
            # "file_path": bpmn_path,
            # relative URLs that the front-end can fetch
            "pnml_url": f"/files/{Path(pnml_file_path).name}",
            "image_url": f"/files/{Path(diagram_path).name}",
        }

    except Exception as e:
        return {"error": str(e)}


@app.post("/check-soundness-xml")
async def check_soundness_xml_endpoint(req: SoundnessRequest):
    """Check if a PNML XML payload is data-aware sound."""
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".pnml", delete=False, encoding="utf-8") as temp_file:
            temp_file.write(req.pnml_xml)
            temp_path = temp_file.name

        is_sound = check_pnml_soundness(temp_path)
        return {"file": req.file_name, "is_sound": is_sound}
    except FileNotFoundError as fnf:
        print(f"FileNotFoundError: {fnf}")
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        print(f"Exception in check_soundness_xml: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=repr(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8081)
