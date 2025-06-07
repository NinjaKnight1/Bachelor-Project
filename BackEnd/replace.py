import xml.etree.ElementTree as ET
import copy
from xml.sax.saxutils import escape



def _attach_guard(transition: ET.Element, guard_expr, add_element: bool = True) -> None:
    """Attach *guard_expr* to *transition*.

    *guard_expr* is escaped and stored in the `guard` XML attribute.  If
    *add_element* is *True* (default) a sibling `<guard><text>…</text></guard>`
    element is also created for ISO-15909 compatible tools.
    """
    # 1. as attribute  (escape &, <, >, ')
    transition.set("guard", escape(guard_expr, {"'": "&apos;"}))

    # 2. as child element (optional but widely supported)
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

