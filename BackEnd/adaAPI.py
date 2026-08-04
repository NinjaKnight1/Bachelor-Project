from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from pydantic import BaseModel
import os
import sys
import runpy
import io
import contextlib


class RunRequest(BaseModel):
    args: list[str] = []

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Path to the `ada` script folder. Can be overridden with env var `ADA_SRC_PATH`.
# Default matches the provided location outside the project folder.
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


@app.post("/run-ada")
async def run_ada_endpoint(req: RunRequest):
    try:
        out = run_ada_script(req.args)
        return out
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        raise HTTPException(status_code=500, detail=repr(e))


@app.post("/check-soundness")
async def check_soundness_endpoint(req: RunRequest):
    """Check if a PNML file is data-aware sound."""
    if not req.args or len(req.args) == 0:
        raise HTTPException(status_code=400, detail="PNML file path required in args")
    
    pnml_file = req.args[0]
    try:
        is_sound = check_pnml_soundness(pnml_file)
        return {"file": pnml_file, "is_sound": is_sound}
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        raise HTTPException(status_code=500, detail=repr(e))

