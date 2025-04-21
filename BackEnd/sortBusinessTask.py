import xml.etree.ElementTree as ET

def business_task_list(bpmn_file_path: str, dmn_file_path: str) -> list:
    tree = ET.parse(bpmn_file_path)
    root = tree.getroot()

    dmn_tree = ET.parse(dmn_file_path)
    dmn_root = dmn_tree.getroot()
    # Define the namespace for BPMN
    bpmnNS = {'bpmn2': 'http://www.omg.org/spec/BPMN/20100524/MODEL'}
    dmnNS = {'dmn': 'https://www.omg.org/spec/DMN/20191111/MODEL/'}
    
    # Find all <bpmn2:businessRuleTask> elements
    business_rule_tasks = root.findall(".//bpmn2:businessRuleTask", bpmnNS)

    task_list = []

    for task in business_rule_tasks:
        task_id = task.get("id")

        # Find the corresponding <dmn:decision> element
        decision = dmn_root.find(f".//dmn:decision[@id='{task_id}']", dmnNS)

        if decision is not None:
            rule_text = []

            #get if for input entries
            rules = decision.findall(".//dmn:inputEntry", dmnNS)

            #list of rules for input entries
            for rule in rules:
                text = rule.find(".//dmn:text", dmnNS)
                if text is not None:
                    rule_text.append(text.text)

        else:
            print("No decision found for task ID:", task_id)

        task_list.append((task_id, rule_text))
        print(f"Task ID: {task_id}, Rules: {rule_text}")

    return task_list

