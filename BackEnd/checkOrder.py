import xml.etree.ElementTree as ET

def determine_execution_order(pnml_path):
    tree = ET.parse(pnml_path)
    root = tree.getroot()

    # Find the <page> element
    page = root.find(".//page")

    # Build a graph from arcs
    arcs = page.findall("arc")
    graph = {}
    for arc in arcs:
        source = arc.get("source")
        target = arc.get("target")
        if source not in graph:
            graph[source] = []
        graph[source].append(target)

    # Find the initial place
    initial_place = None
    places = page.findall("place")
    for place in places:
        if place.find("initialMarking") is not None:
            initial_place = place.get("id")
            break

    if not initial_place:
        raise ValueError("No initial marking found in the PNML file.")

    # Traverse the graph to determine the order
    order_list = []
    visited = set()

    def traverse(node):
        if node in visited:
            return
        visited.add(node)
        order_list.append(node)
        for neighbor in graph.get(node, []):
            traverse(neighbor)

    traverse(initial_place)
    return order_list

