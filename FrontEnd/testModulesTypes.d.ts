declare module 'dmn-js/dist/dmn-modeler.development.js' {
  const DmnModeler: any;
  export default DmnModeler;
}
declare module 'bpmn-js/dist/bpmn-modeler.development.js' {
  const BpmnModeler: new (...args: any[]) => any;
  export default BpmnModeler;
}