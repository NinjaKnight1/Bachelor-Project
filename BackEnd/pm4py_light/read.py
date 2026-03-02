'''
    PM4Py â€“ A Process Mining Library for Python
Copyright (C) 2024 Process Intelligence Solutions UG (haftungsbeschrÃ¤nkt)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see this software project's root or
visit <https://www.gnu.org/licenses/>.

Website: https://processintelligence.solutions
Contact: info@processintelligence.solutions
'''
from typing import Tuple
import os

import tempfile
from urllib.parse import urlparse

from objects.bpmn_obj import BPMN
from objects.petri_net_obj import PetriNet, Marking

import constants

INDEX_COLUMN = "@@index"

__doc__ = """
The `pm4py.read` module contains all functionality related to reading files and objects from disk (or via URIs).
"""


def _resolve_path(file_path: str) -> str:
    """
    Resolve a file path which can be either:
    - A local file path
    - An HTTP/HTTPS URL

    If the path is a remote URL, the file is downloaded to a temporary file,
    and the local temporary file path is returned.
    """
    parsed = urlparse(file_path)
    if parsed.scheme in ("http", "https"):
        import requests
        response = requests.get(file_path)
        response.raise_for_status()
        # Infer the file extension from the URL (if available)
        _, extension = os.path.splitext(parsed.path)
        if not extension:
            extension = ".tmp"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=extension)
        temp_file.write(response.content)
        temp_file.flush()
        temp_file.close()
        return temp_file.name
    else:
        if not os.path.exists(file_path):
            raise Exception(f"File does not exist at path: {file_path}")
        return file_path

def read_pnml(
    file_path: str,
    auto_guess_final_marking: bool = False,
    encoding: str = constants.DEFAULT_ENCODING,
) -> Tuple[PetriNet, Marking, Marking]:
    """
    Reads a Petri net object from a `.pnml` file.
    The returned Petri net object is a tuple containing:

    1. PetriNet object (`PetriNet`)
    2. Initial Marking (`Marking`)
    3. Final Marking (`Marking`)

    :param file_path: Path/URI to the Petri net model (`.pnml` file).
    :param auto_guess_final_marking: Boolean indicating whether to automatically guess the final marking (default: `False`).
    :param encoding: Encoding to be used (default: `utf-8`).
    :rtype: `Tuple[PetriNet, Marking, Marking]`

    .. code-block:: python3

        import pm4py

        pn = pm4py.read_pnml("<path_or_uri_to_pnml_file>")
    """
    local_path = _resolve_path(file_path)
    from pm4py.objects.petri_net.importer import importer as pnml_importer

    net, im, fm = pnml_importer.apply(
        local_path,
        parameters={
            "auto_guess_final_marking": auto_guess_final_marking,
            "encoding": encoding,
        },
    )
    return net, im, fm

def read_bpmn(
    file_path: str, encoding: str = constants.DEFAULT_ENCODING
) -> BPMN:
    """
    Reads a BPMN model from a `.bpmn` file.

    :param file_path: Path/URI to the BPMN model file.
    :param encoding: Encoding to be used (default: `utf-8`).
    :rtype: `BPMN`

    .. code-block:: python3

        import pm4py

        bpmn = pm4py.read_bpmn('<path_or_uri_to_bpmn_file>')
    """
    local_path = _resolve_path(file_path)
    from pm4py.objects.bpmn.importer import importer as bpmn_importer

    bpmn_graph = bpmn_importer.apply(
        local_path, parameters={"encoding": encoding}
    )
    return bpmn_graph
