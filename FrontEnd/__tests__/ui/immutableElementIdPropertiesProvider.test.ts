import {
  ImmutableElementIdPropertiesProvider
} from '../../bpmn/immutableElementIdPropertiesProvider';

describe(
  'immutable element ID properties provider',
  () => {
    test(
      'removes the editable ID entry from the General group',
      () => {
        const propertiesPanel = {
          registerProvider: jest.fn()
        };

        const provider =
          new ImmutableElementIdPropertiesProvider(
            propertiesPanel
          );

        const groups = [
          {
            id: 'general',
            entries: [
              { id: 'name' },
              { id: 'id' }
            ]
          },
          {
            id: 'documentation',
            entries: [
              { id: 'documentation' }
            ]
          }
        ];

        const updatedGroups =
          provider.getGroups({})(groups);

        expect(
          propertiesPanel.registerProvider
        ).toHaveBeenCalledWith(
          500,
          provider
        );

        expect(
          updatedGroups[0].entries
        ).toEqual([
          { id: 'name' }
        ]);

        expect(updatedGroups[1])
          .toBe(groups[1]);

        expect(groups[0].entries)
          .toEqual([
            { id: 'name' },
            { id: 'id' }
          ]);
      }
    );
  }
);