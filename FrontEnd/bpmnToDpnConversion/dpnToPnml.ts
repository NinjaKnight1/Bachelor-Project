import { VariableTypes } from "../translationOfADA";
import { DPN } from "./dpn";

function dpnToPnml(dpn: DPN) {
  const doc = document.implementation.createDocument('', '', null);
  const pnml = doc.createElement('pnml');
  doc.appendChild(pnml);

  const net = doc.createElement('net');
  net.setAttribute('id', '');
  net.setAttribute('type', 'http://www.pnml.org/version-2009/grammar/pnmlcoremodel');

  pnml.appendChild(net);


  const page = doc.createElement('page');
  page.setAttribute('id', '');
  net.appendChild(page);

  appendPlaces(dpn, doc, page);
  appendTransition(dpn, doc, page);
  appendArcs(dpn, doc, page);

  if (dpn.variables.length > 0) {
    const variablesDoc = doc.createElement('variables');

    appendVariables(dpn, doc, variablesDoc);
    net.appendChild(variablesDoc);

  }

  return doc;
}


function appendPlaces(dpn: DPN, doc: XMLDocument, parent: HTMLElement) {
  dpn.places.forEach(place => {
    const placeDoc = doc.createElement('place');
    placeDoc.setAttribute('id', place.id);
    parent.appendChild(placeDoc);

    appendTextElement(doc, placeDoc, place.id);

    const initialMarkings = dpn.source.get(place.id);
    if (initialMarkings !== undefined) {
      appendTextElement(doc, placeDoc, String(initialMarkings), 'initialMarking');
    }
    const finalMarkings = dpn.sink.get(place.id);
    if (finalMarkings !== undefined) {
      appendTextElement(doc, placeDoc, String(finalMarkings), 'finalMarking');
    }
  });
}

function appendTransition(dpn: DPN, doc: XMLDocument, parent: HTMLElement) {
  dpn.transitions.forEach(transition => {
    const transitionDoc = doc.createElement('transition');
    transitionDoc.setAttribute('id', transition.id);

    if (transition.gaurd !== null) {
      transitionDoc.setAttribute('gaurd', transition.gaurd);
    }
    parent.appendChild(transitionDoc);

    appendTextElement(doc, transitionDoc, transition.name ?? " ");


  });
}

function appendArcs(dpn: DPN, doc: XMLDocument, parent: HTMLElement) {
  dpn.arcs.forEach(arc => {
    const arcDoc = doc.createElement('arc');
    arcDoc.setAttribute('id', arc.id);
    arcDoc.setAttribute('source', arc.source);
    arcDoc.setAttribute('target', arc.target);
    parent.appendChild(arcDoc);

    appendTextElement(doc, arcDoc, 'normal', 'arctype');
  });
}


function appendVariables(dpn: DPN, doc: XMLDocument, parent: HTMLElement) {
  dpn.variables.forEach(variable => {
    const variableDoc = doc.createElement('variable');

    switch (variable.type) {
      case VariableTypes.string:
        variableDoc.setAttribute('type', 'java.lang.String');

        break;
      case VariableTypes.number:
        variableDoc.setAttribute('maxValue', '100000.0');
        variableDoc.setAttribute('minValue', '0.0');
        variableDoc.setAttribute('type', 'java.lang.Double');

        break;
      case VariableTypes.boolean:
        variableDoc.setAttribute('type', 'java.lang.Boolean');

        break;
      default:
        break;
    }

    const name = doc.createElement('name');
    name.textContent = variable.name;
    variableDoc.appendChild(name);
    parent.appendChild(variableDoc);

  });
}


function appendTextElement(
  doc: XMLDocument,
  parent: HTMLElement,
  textValue: string,
  tagName: string = 'name',
) {
  const name = doc.createElement(tagName);
  const text = doc.createElement('text');
  text.textContent = textValue;
  name.appendChild(text);
  parent.appendChild(name);

}

function dpnToPnmlFile(dpn: DPN) {
  const doc = dpnToPnml(dpn);
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(doc)}`;
}

export { dpnToPnmlFile }