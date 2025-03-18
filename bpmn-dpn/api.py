import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pm4py

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to ["http://localhost:8081"] for better security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the 'petri_nets' directory exists
PETRI_NETS_DIR = "petri_nets"
os.makedirs(PETRI_NETS_DIR, exist_ok=True)

@app.post("/convert/")
async def convert_bpmn(file: UploadFile = File(...)):
    try:
        # Define the path where the file will be saved
        file_path = os.path.join(PETRI_NETS_DIR, file.filename)

        # Save the uploaded BPMN file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        print(f"File saved at: {file_path}")

        # Read BPMN model from saved file
        bpmn_model = pm4py.read_bpmn(file_path)

        # Convert BPMN to Petri Net
        petri_net, im, fm = pm4py.convert_to_petri_net(bpmn_model)

        return {"message": "Conversion successful!", "file_path": file_path}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
