const LOW_PRIORITY = 500;

interface PropertiesPanelEntry {
  id: string;
  [key: string]: unknown;
}

interface PropertiesPanelGroup {
  id: string;
  entries?: PropertiesPanelEntry[];
  [key: string]: unknown;
}

interface PropertiesPanelLike {
  registerProvider(
    priority: number,
    provider:
      ImmutableElementIdPropertiesProvider
  ): void;
}

export class ImmutableElementIdPropertiesProvider {
  constructor(
    propertiesPanel: PropertiesPanelLike
  ) {
    propertiesPanel.registerProvider(
      LOW_PRIORITY,
      this
    );
  }

  getGroups(
    _element: unknown
  ): (
    groups: PropertiesPanelGroup[]
  ) => PropertiesPanelGroup[] {
    return groups =>
      groups.map(group => {
        if (
          group.id !== 'general' ||
          !group.entries
        ) {
          return group;
        }

        return {
          ...group,
          entries: group.entries.filter(
            entry => entry.id !== 'id'
          )
        };
      });
  }

  static $inject = [
    'propertiesPanel'
  ];
}

export default {
  __init__: [
    'immutableElementIdPropertiesProvider'
  ],

  immutableElementIdPropertiesProvider: [
    'type',
    ImmutableElementIdPropertiesProvider
  ]
};