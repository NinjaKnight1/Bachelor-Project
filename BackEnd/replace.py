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
        gateway_id: str,
        decision_rule: str,
        source_id: str,
        target_id: str,
        output_path: str
):
    tree = ET.parse(pnml_path)
    page = tree.find('./net/page')
    if page is None:
        raise ValueError("No <page> element found in PNML file.")

    gw = page.find(f".//*[@id='{gateway_id}']")
    if gw is None:
        raise ValueError(f"Gateway with id '{gateway_id}' not found.")

    # --- 1. build safe IDs ----------------------------------------------------
    safe = re.sub(r'[^A-Za-z0-9_]', '_', decision_rule)
    tr_id = f"{gateway_id}_{safe}_tr"
    pl_id = f"{gateway_id}_{safe}_pl"

    # --- 2. create transition -------------------------------------------------
    new_tr = ET.Element('transition', id=tr_id)
    name_tr = ET.SubElement(new_tr, 'name')
    ET.SubElement(name_tr, 'text').text = tr_id
    _attach_guard(new_tr, decision_rule)      # helper in replace.py :contentReference[oaicite:0]{index=0}

    # --- 3. create place ------------------------------------------------------
    new_pl = ET.Element('place', id=pl_id)
    name_pl = ET.SubElement(new_pl, 'name')
    ET.SubElement(name_pl, 'text').text = pl_id

    # --- 4. create legal arcs -------------------------------------------------
    page.append(ET.Element('arc',
        id=f"{source_id}_to_{tr_id}",
        source=source_id,
        target=tr_id))
    page.append(ET.Element('arc',
        id=f"{tr_id}_to_{pl_id}",
        source=tr_id,
        target=pl_id))
    page.append(ET.Element('arc',
        id=f"{pl_id}_to_{target_id}",
        source=pl_id,
        target=target_id))

    # --- 5. add new nodes to page --------------------------------------------
    page.extend([new_tr, new_pl])

    # --- 6. remove gateway *and* its dangling arcs ---------------------------
    for arc in list(page.findall('arc')):
        if arc.get('source') == gateway_id or arc.get('target') == gateway_id:
            page.remove(arc)
    page.remove(gw)

    tree.write(output_path, encoding='utf-8', xml_declaration=True)