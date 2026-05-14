import copy
import json
import re
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape as _esc


def _attach_guard(
    transition: ET.Element,
    guard_expr: str,
    add_element: bool = True,
) -> None:
    guard_expr = (guard_expr or "").strip()
    if not guard_expr:
        return

    transition.set("guard", guard_expr)

    if add_element:
        for old_guard in list(transition.findall("guard")):
            transition.remove(old_guard)

        guard_el = ET.SubElement(transition, "guard")
        text_el = ET.SubElement(guard_el, "text")
        text_el.text = guard_expr


def _combine_guard(pre_cond: str, post_cond: str) -> str:
    """
    Combine pre/post conditions safely.

    Avoid producing invalid expressions like:
      x > 3 &&

    If one side is empty, just return the other.
    """
    pre = (pre_cond or "").strip()
    post = (post_cond or "").strip()

    if pre and post:
        return f"{pre} && {post}"
    if pre:
        return pre
    if post:
        return post
    return ""


def _sanitize_id_part(value: str) -> str:
    """
    Make a safe XML id fragment from arbitrary text.
    """
    value = "" if value is None else str(value)
    value = re.sub(r"[^A-Za-z0-9_.-]+", "_", value)
    value = value.strip("_")
    return value or "x"


def _clear_transition_guard(transition: ET.Element) -> None:
    """
    Remove guard attribute and guard child elements from a transition.
    """
    if "guard" in transition.attrib:
        del transition.attrib["guard"]

    for old_guard in list(transition.findall("guard")):
        transition.remove(old_guard)


def createArc(source: str, target: str, arc_id: str, page: ET.Element) -> ET.Element:
    arc = ET.Element("arc")
    arc.set("id", arc_id)
    arc.set("source", source)
    arc.set("target", target)
    page.append(arc)
    return arc


def _create_place(page: ET.Element, place_id: str, place_name: str) -> ET.Element:
    """
    Create a place with the structure expected by the PNML reader:
      <place id="...">
        <name><text>...</text></name>
      </place>
    """
    place = ET.Element("place")
    place.set("id", place_id)

    name_el = ET.SubElement(place, "name")
    text_el = ET.SubElement(name_el, "text")
    text_el.text = place_name

    page.append(place)
    return place


def _infer_java_type(type_hint: str, raw_value: str) -> str:
    hint = (type_hint or "").strip().lower()
    value = "" if raw_value is None else str(raw_value).strip()

    if hint in {"number", "int", "integer"}:
        return "java.lang.Integer"
    if hint in {"float", "double"}:
        return "java.lang.Double"
    if hint in {"bool", "boolean"}:
        return "java.lang.Boolean"
    if hint in {"string", "str"}:
        return "java.lang.String"

    if re.fullmatch(r"[+-]?\d+", value):
        return "java.lang.Integer"
    if re.fullmatch(r"[+-]?\d*\.\d+", value):
        return "java.lang.Double"
    if value.lower() in {"true", "false"}:
        return "java.lang.Boolean"
    return "java.lang.String"


def add_variables_from_json_to_pnml(
    pnml_path: str,
    json_path: str,
    output_path: str | None = None,
):
    """
    Replace/add the <variables> block in the PNML file from a JSON file.

    Expected JSON shape:
      {
        "variableName": [
          {"name": "x", "type": "number", "value": 0},
          ...
        ]
      }

    The PNML reader expects:
      <variables>
        <variable type="java.lang.Integer" initial="0">
          <name>x</name>
        </variable>
      </variables>
    """
    with open(json_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    variable_list = data.get("variableName", [])

    tree = ET.parse(pnml_path)
    root = tree.getroot()
    net = root.find("net")
    if net is None:
        raise ValueError("No <net> element found in PNML file.")

    # Remove existing variables blocks
    for variables_node in list(net.findall("variables")):
        net.remove(variables_node)

    variables = ET.Element("variables")

    for item in variable_list:
        name = item.get("name")
        if not name:
            continue

        raw_value = item.get("value", "0")
        java_type = _infer_java_type(item.get("type", ""), raw_value)

        attrs = {
            "type": java_type,
            "initial": str(raw_value),
        }

        # Only numeric types get min/max constraints
        if java_type in ("java.lang.Integer", "java.lang.Double"):
            attrs["minValue"] = "0"
            attrs["maxValue"] = "100000"

        variable_el = ET.SubElement(variables, "variable", attrs)

        name_el = ET.SubElement(variable_el, "name")
        name_el.text = str(name)

    net.append(variables)

    target_path = output_path or pnml_path
    ET.indent(tree, space="  ", level=0)
    tree.write(
        target_path,
        encoding="utf-8",
        xml_declaration=True,
        short_empty_elements=False,
    )


def split_pnml_element(
    pnml_path: str,
    element_id: str,
    rules: list,
    output_path: str,
):
    """
    Split one transition into several transitions, one per rule.

    Each new transition inherits the original transition structure and arcs,
    but gets its own id and guard.

    rules can contain either:
      - tuple(pre_cond, post_cond)
      - plain string guard
    """
    tree = ET.parse(pnml_path)
    root = tree.getroot()

    net = root.find("net")
    if net is None:
        raise ValueError("No <net> element found in PNML file.")

    page = net.find("page")
    if page is None:
        raise ValueError("No <page> element found in PNML file.")

    target = page.find(f".//*[@id='{element_id}']")
    if target is None:
        raise ValueError(f"Element with id='{element_id}' not found.")

    if target.tag != "transition":
        raise ValueError(f"Element '{element_id}' is not a <transition>.")

    norm_rules = []
    for r in rules:
        if isinstance(r, tuple):
            if len(r) != 2:
                raise ValueError("Tuple rules must have exactly two items: (pre_cond, post_cond)")
            norm_rules.append(r)
        else:
            norm_rules.append((str(r), ""))

    new_ids = []

    for i, (pre_cond, post_cond) in enumerate(norm_rules, start=1):
        new_id = f"{element_id}_{i}"
        new_ids.append(new_id)

        new_tr = copy.deepcopy(target)
        new_tr.set("id", new_id)

        # Update visible name if present
        name_text = new_tr.find("./name/text")
        if name_text is not None:
            base_name = name_text.text or element_id
            name_text.text = f"{base_name}_{i}"
        elif "name" in new_tr.attrib:
            new_tr.set("name", f"{new_tr.get('name')}_{i}")

        # Remove any existing guards from the copied transition
        _clear_transition_guard(new_tr)

        guard_input = _combine_guard(pre_cond, post_cond)
        if guard_input:
            _attach_guard(new_tr, guard_input)

        page.append(new_tr)

    # Duplicate incoming and outgoing arcs for each new transition
    for arc in list(page.findall("arc")):
        src = arc.get("source")
        tgt = arc.get("target")
        old_arc_id = arc.get("id", "arc")

        if src == element_id:
            for i, new_id in enumerate(new_ids, start=1):
                arc_src = copy.deepcopy(arc)
                arc_src.set("source", new_id)
                arc_src.set("id", f"{old_arc_id}_{i}")
                page.append(arc_src)
            page.remove(arc)

        elif tgt == element_id:
            for i, new_id in enumerate(new_ids, start=1):
                arc_tgt = copy.deepcopy(arc)
                arc_tgt.set("target", new_id)
                arc_tgt.set("id", f"{old_arc_id}_{i}")
                page.append(arc_tgt)
            page.remove(arc)

    page.remove(target)

    ET.indent(tree, space="  ", level=0)
    tree.write(
        output_path,
        encoding="utf-8",
        xml_declaration=True,
        short_empty_elements=False,
    )


def split_gateway(
    pnml_path: str,
    element_id: str,
    rules: list,
    output_path: str,
):
    """
    Replace outgoing behavior from gateway exi_<element_id> with one guarded
    transition per rule.

    Expected rules:
      [(rule_expr, target_id), ...]

    Produced structure per rule:
      exi_<element_id> -> guarded_transition -> place -> target

    This avoids the previous duplicated/double-input wiring.
    """
    tree = ET.parse(pnml_path)
    root = tree.getroot()

    net = root.find("net")
    if net is None:
        raise ValueError("No <net> element found in PNML file.")

    page = net.find("page")
    if page is None:
        raise ValueError("No <page> element found in PNML file.")

    gateway_id = f"exi_{element_id}"
    gateway = page.find(f".//*[@id='{gateway_id}']")
    if gateway is None:
        raise ValueError(f"Gateway with id='{gateway_id}' not found.")

    # Remove all outgoing arcs from the gateway
    for arc in list(page.findall("arc")):
        if arc.get("source") == gateway_id:
            page.remove(arc)

    for idx, entry in enumerate(rules, start=1):
        if not isinstance(entry, (list, tuple)) or len(entry) != 2:
            raise ValueError("Each gateway rule must be a pair: (rule_expr, target_id)")

        rule, target = entry
        rule = (rule or "").strip()
        if not target:
            raise ValueError("Each gateway rule must include a non-empty target id.")

        tr_id = f"{gateway_id}_{idx}"
        place_id = f"place_{element_id}_{idx}"

        new_transition = ET.Element("transition")
        new_transition.set("id", tr_id)
        new_transition.set("name", f"Xor_{idx}")

        # Add visible name in the reader-friendly structure if desired
        name_el = ET.SubElement(new_transition, "name")
        text_el = ET.SubElement(name_el, "text")
        text_el.text = f"Xor_{idx}"

        if rule:
            _attach_guard(new_transition, rule)

        page.append(new_transition)

        createArc(
            gateway_id,
            tr_id,
            f"arc_{element_id}_{idx}_gateway_to_transition",
            page,
        )

        _create_place(page, place_id, f"Place_{element_id}_{idx}")

        createArc(
            tr_id,
            place_id,
            f"arc_{element_id}_{idx}_transition_to_place",
            page,
        )

        createArc(
            place_id,
            target,
            f"arc_{element_id}_{idx}_place_to_target",
            page,
        )

    ET.indent(tree, space="  ", level=0)
    tree.write(
        output_path,
        encoding="utf-8",
        xml_declaration=True,
        short_empty_elements=False,
    )

def set_ada_markings(
    pnml_path: str,
    output_path: str | None = None,
    start_place_id: str = "source",
    final_place_id: str = "sink",
):
    tree = ET.parse(pnml_path)
    root = tree.getroot()

    net = root.find("net")
    if net is None:
        raise ValueError("No <net> element found in PNML file.")

    page = net.find("page")
    if page is None:
        raise ValueError("No <page> element found in PNML file.")

    def remove_children(place: ET.Element, tag: str) -> None:
        for child in list(place.findall(tag)):
            place.remove(child)

    def add_marking(place: ET.Element, tag: str, value: int) -> None:
        remove_children(place, tag)
        marking_el = ET.SubElement(place, tag)
        text_el = ET.SubElement(marking_el, "text")
        text_el.text = str(value)

    start_place = page.find(f".//place[@id='{start_place_id}']")
    if start_place is None:
        raise ValueError(f"Start place '{start_place_id}' not found.")

    final_place = page.find(f".//place[@id='{final_place_id}']")
    if final_place is None:
        raise ValueError(f"Final place '{final_place_id}' not found.")

    add_marking(start_place, "initialMarking", 1)
    add_marking(final_place, "finalMarking", 1)

    target_path = output_path or pnml_path
    ET.indent(tree, space="  ", level=0)
    tree.write(
        target_path,
        encoding="utf-8",
        xml_declaration=True,
        short_empty_elements=False,
    )