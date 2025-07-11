import {
  assign
} from 'min-dash';

function CustomPaletteProvider(
  palette, create, elementFactory,
  spaceTool, lassoTool, handTool,
  globalConnect, translate) {

  this._palette = palette;
  this._create = create;
  this._elementFactory = elementFactory;
  this._spaceTool = spaceTool;
  this._lassoTool = lassoTool;
  this._handTool = handTool;
  this._globalConnect = globalConnect;
  this._translate = translate;

  palette.registerProvider(this);
}

CustomPaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'spaceTool',
  'lassoTool',
  'handTool',
  'globalConnect',
  'translate'
];


CustomPaletteProvider.prototype.getPaletteEntries = function () {
  var actions = {},
    create = this._create,
    elementFactory = this._elementFactory,
    spaceTool = this._spaceTool,
    lassoTool = this._lassoTool,
    handTool = this._handTool,
    globalConnect = this._globalConnect,
    translate = this._translate;

  function createAction(type, group, className, title, options) {

    function createListener(event) {
      var shape = elementFactory.createShape(assign({ type: type }, options));
      create.start(event, shape);
    }

    return {
      group: group,
      className: className,
      title: title,
      action: {
        dragstart: createListener,
        click: createListener
      }
    };
  }

  // function createSubprocess(event) {
  //   var subProcess = elementFactory.createShape({
  //     type: 'bpmn:SubProcess',
  //     x: 0,
  //     y: 0,
  //     isExpanded: true
  //   });

  //   var startEvent = elementFactory.createShape({
  //     type: 'bpmn:StartEvent',
  //     x: 40,
  //     y: 82,
  //     parent: subProcess
  //   });

  //   create.start(event, [subProcess, startEvent], {
  //     hints: {
  //       autoSelect: [subProcess]
  //     }
  //   });
  // }

  // function createParticipant(event) {
  //   create.start(event, elementFactory.createParticipantShape());
  // }

  assign(actions, {
    'hand-tool': {
      group: 'tools',
      className: 'bpmn-icon-hand-tool',
      title: translate('Activate hand tool'),
      action: {
        click: function (event) {
          handTool.activateHand(event);
        }
      }
    },
    'lasso-tool': {
      group: 'tools',
      className: 'bpmn-icon-lasso-tool',
      title: translate('Activate lasso tool'),
      action: {
        click: function (event) {
          lassoTool.activateSelection(event);
        }
      }
    },
    'space-tool': {
      group: 'tools',
      className: 'bpmn-icon-space-tool',
      title: translate('Activate create/remove space tool'),
      action: {
        click: function (event) {
          spaceTool.activateSelection(event);
        }
      }
    },
    'global-connect-tool': {
      group: 'tools',
      className: 'bpmn-icon-connection-multi',
      title: translate('Activate global connect tool'),
      action: {
        click: function (event) {
          globalConnect.start(event);
        }
      }
    },
    'tool-separator': {
      group: 'tools',
      separator: true
    },
    'create.start-event': createAction(
      'bpmn:StartEvent', 'event', 'bpmn-icon-start-event-none',
      translate('Create start event')
    ),
    // 'create.intermediate-event': createAction(
    //   'bpmn:IntermediateThrowEvent', 'event', 'bpmn-icon-intermediate-event-none',
    //   translate('Create intermediate/boundary event')
    // ),
    'create.end-event': createAction(
      'bpmn:EndEvent', 'event', 'bpmn-icon-end-event-none',
      translate('Create end event')
    ),
    'create.exclusive-gateway': createAction(
      'bpmn:ExclusiveGateway', 'gateway', 'bpmn-icon-gateway-none',
      translate('Create gateway')
    ),
    'create.task': createAction(
      'bpmn:Task', 'activity', 'bpmn-icon-task',
      translate('Create task')
    ),
    // 'create.data-object': createAction(
    //   'bpmn:DataObjectReference', 'data-object', 'bpmn-icon-data-object',
    //   translate('Create data object reference')
    // ),
    // 'create.data-store': createAction(
    //   'bpmn:DataStoreReference', 'data-store', 'bpmn-icon-data-store',
    //   translate('Create data store reference')
    // ),
    // 'create.subprocess-expanded': {
    //   group: 'activity',
    //   className: 'bpmn-icon-subprocess-expanded',
    //   title: translate('Create expanded sub-process'),
    //   action: {
    //     dragstart: createSubprocess,
    //     click: createSubprocess
    //   }
    // },
    // 'create.participant-expanded': {
    //   group: 'collaboration',
    //   className: 'bpmn-icon-participant',
    //   title: translate('Create pool/participant'),
    //   action: {
    //     dragstart: createParticipant,
    //     click: createParticipant
    //   }
    // },
    // 'create.group': createAction(
    //   'bpmn:Group', 'artifact', 'bpmn-icon-group',
    //   translate('Create group')
    // ),
  });

  return actions;
};

export default {
  paletteProvider: ['type', CustomPaletteProvider],
};