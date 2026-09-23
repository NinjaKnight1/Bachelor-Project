# Bachelor-Project

Automated Conversion of Integrated BPMN and DMN Models into Data Petri Nets.

## Prerequisites
# Connect ADA

https://gitlab.inf.unibz.it/SarahMaria.Winkler/ada

ADA is used by the backend for data-aware soundness checks and LTLf model checking. It is not included in this repository, so obtain the ADA source repository separately and keep its directory structure intact. The backend needs the path to ADA's `src` folder—the folder that contains `ada.py`.

Set the `ADA_SRC_PATH` environment variable before starting the backend. Replace `/path/to/ada` with the location of your ADA checkout:

```bash
export ADA_SRC_PATH="/path/to/ada/src"
python BackEnd/api.py
```

For example, if `Bachelor-Project` and `ada` are sibling folders:

```text
Bachelor/
├── Bachelor-Project/
└── ada/
    └── src/
        └── ada.py
```

then run this from `Bachelor-Project`:

```bash
export ADA_SRC_PATH="../ada/src"
python BackEnd/api.py
```

On Windows PowerShell, use:

```powershell
$env:ADA_SRC_PATH = "C:\path\to\ada\src"
python BackEnd/api.py
```

If `ADA_SRC_PATH` is not set, the backend falls back to the developer-specific path configured in `BackEnd/api.py`; set the variable to make the project portable. If ADA cannot be found, the backend reports that `ada.py` is missing. Install any Python dependencies required by ADA according to its own setup instructions.

# Install dependencies
Install the frontend dependencies and Python backend dependencies from the project root:

```bash
npm install
pip install -r requirements.txt
```

## Run the project

Start the backend (with `ADA_SRC_PATH` set if you want ADA features), then start the frontend in a second terminal:

```bash
python BackEnd/api.py
npm start
```

## Tests

```bash
npm test
```

To run tests with `console.log` output visible:

```bash
npm run test:print
```
