import json
import xml.etree.ElementTree as ET
import re
from typing import List, Tuple


def business_task_list_json(bpmn_file_path: str | None, dmn_json_path: str):
    tree = ET.parse(bpmn_file_path)
    root = tree.getroot()

    # Define the namespace for BPMN
    bpmnNS = {'bpmn2': 'http://www.omg.org/spec/BPMN/20100524/MODEL'}
    
    # Find all <bpmn2:businessRuleTask> elements
    business_rule_tasks = root.findall(".//bpmn2:businessRuleTask", bpmnNS)

    bpmn_task_ids = set()

    for task in business_rule_tasks:
        task_id = task.get("id")
        if task_id:
            bpmn_task_ids.add(task_id)

    # Load DMN JSON file
    with open(dmn_json_path, "r", encoding="utf‑8") as fh:
        data = json.load(fh)

    table_map = {
        table["tableId"]: table.get("rules", [])
        for table in data.get("dmn", [])
    }

    result: list[Tuple[str, List[Tuple[str, str]]]] = []

    # If we have BPMN task IDs use those; otherwise use every DMN table.
    target_ids = bpmn_task_ids or table_map.keys()

    for task_id in target_ids:
        # Discover output column names for this DMN table
        output_names = [
            o["expression"]
            for t in data.get("dmn", [])
            if t["tableId"] == task_id
            for o in t.get("outputs", [])
        ]

        rule_pairs: list[tuple[str, str]] = []
        for rule in table_map.get(task_id, []):
            post_expr = rule["post"]

            # Add apostrophe immediately after each output name on the LHS
            for name in output_names:
                post_expr = re.sub(
                    rf"\(=\s*{re.escape(name)}\b",
                    f"(= {name}\'",
                    post_expr,
                    count=1
                )

            rule_pairs.append((rule["pre"], post_expr))

        if not rule_pairs:
            print(f"No rules found for task ID: {task_id}")
        result.append((task_id, rule_pairs))  # Append as a tuple, not a list

    return result


def _Xor_gatewayRules(bpmn_file_path: str | None, dmn_json_path: str):
    tree = ET.parse(bpmn_file_path)
    root = tree.getroot()

    # Define the namespace for BPMN
    bpmnNS = {'bpmn2': 'http://www.omg.org/spec/BPMN/20100524/MODEL'}
    
    # Find all <bpmn2:exclusiveGateway> elements
    xor_gates = root.findall(".//bpmn2:exclusiveGateway", bpmnNS)

    xor_ids = set()

    for task in xor_gates:
        task_id = task.get("id")
        if task_id:
            xor_ids.add(task_id)

    # Load DMN JSON file
    with open(dmn_json_path, "r", encoding="utf‑8") as fh:
        data = json.load(fh)

    # Build a mapping from sourceId to a list of rules (as dicts)
    table_map = {}
    for table in data.get("bpmn", []):
        source_id = table["sourceId"]
        table_map.setdefault(source_id, []).append(table)

    result: list[Tuple[str, List[Tuple[str, Tuple[str, str]]]]] = []

    # If we have BPMN XOR gateway IDs use those; otherwise use every sourceId in table_map.
    target_ids = xor_ids or table_map.keys()

    print("Xor Gateway IDs:", target_ids)
    print("Table Map:", table_map)

    for task_id in target_ids:
        expressions: list[Tuple[str, Tuple[str, str]]] = []
        for rule in table_map.get(task_id, []):
            # Here we use rule["pre"] as the expression and then append the sourceId along with the targetId as a tuple.
            expressions.append((rule["pre"], (rule["sourceId"], rule["targetId"])))
        if not expressions:
            print(f"No rules found for task ID: {task_id}")
        result.append((task_id, expressions))
        
    print("Xor Gateway Rules FROM json_mani:", result)

    return result


if __name__ == "__main__":
    bpmn_path = "petri_nets/diagram.bpmn"
    dmn_json_path = "petri_nets/diagramDecisions.json"
    X_or = _Xor_gatewayRules(bpmn_path, dmn_json_path)
    print("X_or List:", X_or)