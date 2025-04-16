import xml.etree.ElementTree as ET

def business_task_list(bpmn_file_path: str):
    tree = ET.parse(bpmn_file_path)
    root = tree.getroot()

    # Define the namespace for BPMN
    namespaces = {'bpmn2': 'http://www.omg.org/spec/BPMN/20100524/MODEL'}

    # Find all <bpmn2:businessRuleTask> elements
    business_rule_tasks = root.findall(".//bpmn2:businessRuleTask", namespaces)

    # Extract the IDs of the business rule tasks
    task_ids = [task.get("id") for task in business_rule_tasks]

    

    return task_ids

