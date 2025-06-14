import json
import xml.etree.ElementTree as ET
import re
from typing import List, Tuple
from collections import defaultdict

def merge_gateway_rules(items):
    """
    items – list of (gateway_id, (rule, target_id)) tuples
    returns – list of (gateway_id, [ (rule, target_id), … ]) tuples
    """
    buckets = defaultdict(list)            # gateway_id ➜ list of (rule, target)
    for gw_id, pair in items:
        buckets[gw_id].append(pair)

    # if order matters, use a normal dict and keep track of insert order
    return [(gw_id, rules) for gw_id, rules in buckets.items()]



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


def _Xor_gatewayRules(dmn_json_path: str):

   # Load DMN JSON file
    with open(dmn_json_path, "r", encoding="utf‑8") as fh:
        data = json.load(fh)

    # Build a mapping from sourceId to list of rule dictionaries from "bpmn"
    table_map = {}
    for table in data.get("bpmn", []):
        source_id = table["sourceId"]
        table_map.setdefault(source_id, []).append(table)

    # This will hold tuples of (task_id, List[Tuple[str, str]])
    result: list[Tuple[str, List[Tuple[str, str]]]] = []

    # SourceId in table_map.
    target_ids = table_map.keys()

    for task_id in target_ids:
        #Find rule expressions for this task_id
        rules = table_map.get(task_id, [])
        if not rules:
            print(f"No rules found for task ID: {task_id}")
            continue
        for rule in rules:
            # Extract the target ID from the rule
            target_id = rule.get("targetId", "")
            if not target_id:
                print(f"No targetId found for task ID: {task_id}")
                continue

            # Append the task_id and its rules as a tuple
            result.append((task_id, (rule["pre"], target_id)))
        
    # Merge rules for each gateway ID
    result = merge_gateway_rules(result)
    print("Xor Gateway Rules:", result)
    return result


if __name__ == "__main__":
    dmn_json_path = "petri_nets/diagramDecisions.json"
    X_or = _Xor_gatewayRules(dmn_json_path)
    print("X_or List:", X_or)