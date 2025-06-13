import xml.etree.ElementTree as ET
import copy
import re
from xml.sax.saxutils import escape as _esc
import xml.etree.ElementTree as ET


def _attach_guard(
    transition: ET.Element,
    guard_expr: str,
    add_element: bool = True,
) -> None:


    transition.set("guard", _esc(guard_expr, {'"': "&quot;"}))
    
    if add_element:
        guard_el = ET.SubElement(transition, "guard")
        text_el = ET.SubElement(guard_el, "text")
        text_el.text = guard_expr


def createArc(source, target, arc_id, page):
    arc = ET.Element("arc")
    arc.set("id", arc_id)
    arc.set("source", source)
    arc.set("target", target)
    page.append(arc)


def split_pnml_element(
    pnml_path: str,
    element_id: str,
    rules: list,
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

    norm_rules= []
    for r in rules:
        if isinstance(r, tuple):
            norm_rules.append(r)
        else:  # assume plain string guard, no post-condition
            norm_rules.append((r, ""))


    new_ids = []
    for i, (pre_cond, post_cond) in enumerate(norm_rules, start=1):
        new_id = f"{element_id}_{i}"
        new_ids.append(new_id)

        new_tr = copy.deepcopy(target)
        new_tr.set("id", new_id)

        # rename visual label if present
        name_text = new_tr.find("./name/text")
        if name_text is not None and name_text.text:
            name_text.text = f"{name_text.text}_{i}"

        # attach guard expression (using pre-condition)

        guard_input = f"PRE: {pre_cond} \n POST: {post_cond}"
        _attach_guard(new_tr, guard_input)

        page.append(new_tr)

    # Update arcs
    arcs = page.findall('arc')
    for arc in list(arcs):
        src = arc.get('source')
        tgt = arc.get('target')

        if src == element_id:

            # Create new arcs for each new ID
            for i, new_id in enumerate(new_ids):
                arc_src = copy.deepcopy(arc)
                arc_src.set('source', new_id)
                arc_src.set('id', arc.get('id') + f'_{i+1}')

                page.append(arc_src)
            page.remove(arc)

        elif tgt == element_id:
            # Create new arcs for each new ID
            for i, new_id in enumerate(new_ids):
                arc_tgt = copy.deepcopy(arc)
                arc_tgt.set('target', new_id)
                arc_tgt.set('id', arc.get('id') + f'_{i+1}')
                

                page.append(arc_tgt)
            page.remove(arc)

    page.remove(target)
    tree.write(output_path, encoding='utf-8', xml_declaration=True)

def split_gateway(
    pnml_path: str,
    element_id: str,
    rules: list,
    output_path: str
):
    #read the PNML file
    tree = ET.parse(pnml_path)
    root = tree.getroot()
    net = root.find('net')
    page = net.find('page')
    if page is None:
        raise ValueError("No <page> element found in PNML file.")
    # Find the gateway element by existing element ID
    gateway = page.find(f".//*[@id='exi_{element_id}']")

    if gateway is None:
        raise ValueError(f"Gateway with id='exi_{element_id}' not found.")
    
    #Find arc which connects the gateway to the source
    source = None
    arcs = page.findall('arc')
    for arc in arcs:
        if arc.get('target') == f'exi_{element_id}':
            source = arc.get('source')
            break
    if source is None:
        raise ValueError(f"No arc found connecting to gateway with id='exi_{element_id}'.")
    
    #remove all outgoing arcs from the gateway
    for arc in list(page.findall('arc')):
        if arc.get('source') == f'exi_{element_id}':
            page.remove(arc)
    

    for rule, target in rules:

        #Create new transition element (not a deepcopy, but a new element)
        new_transition = ET.Element("transition")
        new_transition.set("id", f"exi_{element_id}_{rule}")
        new_transition.set("name", f"Xor: {rule}")

        # Set the guard expression
        guard_input = f"PRE: {rule} \n POST: true"
        _attach_guard(new_transition, guard_input)

        # Add the new transition to the page
        page.append(new_transition)

        #Create arch from the gateway -> new transition
        createArc(f"exi_{element_id}", f"exi_{element_id}_{rule}", f"arc_{element_id}_{rule}", page)

        # Create new arcs for the gateway
        createArc(source, f"exi_{element_id}_{rule}", f"arc_{element_id}_{rule}", page)

        # Create place which goes new transition -> target
        new_place = ET.Element("place")
        new_place.set("id", f"place_{element_id}_{rule}")
        new_place.set("name", f"Place_{element_id}_{rule}")
        page.append(new_place)

        # Create arc from new transition to new place
        createArc(f"exi_{element_id}_{rule}", f"place_{element_id}_{rule}", f"arc_{element_id}_{rule}_to_place", page)

        # Create arc from new place to target
        createArc(f"place_{element_id}_{rule}", target, f"arc_{element_id}_{rule}_to_target", page)


    ET.indent(tree, space="  ", level=0)     # 2-space indent; tweak as you like
    tree.write(output_path,
           encoding='utf-8',
           xml_declaration=True,
           short_empty_elements=False)   # expands <arc … /> → <arc …></arc> 