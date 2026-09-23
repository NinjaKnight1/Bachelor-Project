import type Palette from 'diagram-js/lib/features/palette/Palette';
import type Create from 'diagram-js/lib/features/create/Create';
import type ElementFactory from 'diagram-js/lib/core/ElementFactory';

import type {
  PaletteEntries,
  PaletteEntriesCallback,
  PaletteEntry
} from 'diagram-js/lib/features/palette/PaletteProvider';

type Translate = (
  template: string,
  replacements?: Record<string, string>
) => string;

const LOW_PRIORITY = 500;

const ALLOWED_CREATE_ENTRIES = new Set([
  'create.start-event',
  'create.end-event',
  'create.task',
  'create.business-rule-task',
  'create.exclusive-gateway',
  'create.parallel-gateway'
]);



class ModifiedPaletteProvider {
  private create: Create;
  private elementFactory: ElementFactory;
  private translate: Translate;
  
  static $inject = [
    'palette',
    'create',
    'elementFactory',
    'translate'
  ];

  constructor(
    palette: Palette,
    create: Create,
    elementFactory: ElementFactory,
    translate: Translate
  ) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.translate = translate;

    palette.registerProvider(LOW_PRIORITY, this);
  }

  getPaletteEntries() {
    const create = this.create;
    const elementFactory = this.elementFactory;
    const translate = this.translate;

    function createAction(type: string, group: string, className: string, title: string): PaletteEntry {
      function createElement(event: Event): void {
        const shape = elementFactory.createShape({ type });

        create.start(event, shape);
      }

      return {
        group,
        className,
        title,
        action: {
          dragstart: createElement,
          click: createElement
        }
      };
    }

    return function filterPaletteEntries(entries: PaletteEntries): PaletteEntries {
      Object.keys(entries).forEach(entryId => {
        const isCreationEntry = entryId.startsWith('create.');
        const isAllowed = ALLOWED_CREATE_ENTRIES.has(entryId);

        if (isCreationEntry && !isAllowed) {
          delete entries[entryId];
        }
      });

      entries['create.business-rule-task'] = createAction(
        'bpmn:BusinessRuleTask',
        'activity',
        'bpmn-icon-business-rule-task',
        translate('Create business rule task')
      );

      entries['create.parallel-gateway'] = createAction(
        'bpmn:ParallelGateway',
        'gateway',
        'bpmn-icon-gateway-parallel',
        translate('Create parallel gateway')
      );

      return entries;
    };
  }
}


export default {
  __init__: [
    'modifiedPaletteProvider'
  ],
  modifiedPaletteProvider: [
    'type',
    ModifiedPaletteProvider
  ]
};