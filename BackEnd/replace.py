import xml.etree.ElementTree as ET
import copy

def split_pnml_element(
    pnml_path: str,
    element_id: str,
    new_element: int,
    output_path: str
):
    tree = ET.parse(pnml_path)
    root = tree.getroot()

    net = root.find('net')
    page = net.find('page')
    if page is None:
        raise ValueError("No <page> element found in PNML file.")

    # Find element by ID
    target = page.find(f".//*[@id='{element_id}']")
    if target is None:
        raise ValueError(f"Element with id='{element_id}' not found.")

    # Create new IDs
    list_new_ids = []
    for i in range(new_element):
        new_id = f"{element_id}_{i+1}"
        list_new_ids.append(new_id)
    
    # Create new duplicates
    for i, new_id in enumerate(list_new_ids):
        new = copy.deepcopy(target)
        new.set('id', new_id)
        page.append(new)

    # Update arcs
    arcs = page.findall('arc')
    for arc in list(arcs):
        src = arc.get('source')
        tgt = arc.get('target')

        if src == element_id:

            # Create new arcs for each new ID
            for i, new_id in enumerate(list_new_ids):
                arc1 = copy.deepcopy(arc)
                arc1.set('source', new_id)
                arc1.set('id', arc.get('id') + f'_{i+1}')
                _set_arc_label_plain(arc1, f"Label to {i+1}")

                page.append(arc1)
            page.remove(arc)

        elif tgt == element_id:
            # Create new arcs for each new ID
            for i, new_id in enumerate(list_new_ids):
                arc1 = copy.deepcopy(arc)
                arc1.set('target', new_id)
                arc1.set('id', arc.get('id') + f'_{i+1}')
                _set_arc_label_plain(arc1, f"Label to {i+1}")

                page.append(arc1)
            page.remove(arc)
    page.remove(target)
    tree.write(output_path, encoding='utf-8', xml_declaration=True)

def _set_arc_label_plain(arc, label):
    # Remove existing <name> tag
    for child in list(arc):
        if child.tag == 'name':
            arc.remove(child)

    name = ET.Element('name')
    text = ET.SubElement(name, 'text')
    text.text = label
    arc.append(name)