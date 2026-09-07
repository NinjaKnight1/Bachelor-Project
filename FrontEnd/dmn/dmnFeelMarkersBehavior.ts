import {
  modelFeelAnalysisState
} from '../modelFeelAnalysisState';

import type {
  ModelFeelAnalysisResult
} from '../modelFeelAnalysis';

import {
  collectModelFeelErrors
} from '../modelFeelErrors';

import {
  syncDmnFeelMarkers
} from './dmnFeelMarkers';

interface DmnFeelMarkersEventBus {
  on(
    event: string,
    listener: () => void
  ): void;
}

interface DmnFeelMarkersRenderer {
  getContainer(): Element;
}

interface DmnFeelMarkersState {
  getResult(): ModelFeelAnalysisResult;

  getInitialValues(): Record<string, string>;

  subscribe(
    listener:
      (result: ModelFeelAnalysisResult) => void
  ): () => void;

  subscribeInitialValues(
    listener:
      (
        initialValues:
          Record<string, string>
      ) => void
  ): () => void;
}

export class DmnFeelMarkersBehavior {
  private readonly unsubscribeResult:
    () => void;

  private readonly unsubscribeInitialValues:
    () => void;

  constructor(
    private readonly eventBus:
      DmnFeelMarkersEventBus,

    private readonly renderer:
      DmnFeelMarkersRenderer,

    private readonly state:
      DmnFeelMarkersState =
        modelFeelAnalysisState
  ) {
    this.unsubscribeResult =
      state.subscribe(() => {
        this.synchronize();
      });

    this.unsubscribeInitialValues =
      state.subscribeInitialValues(() => {
        this.synchronize();
      });

    eventBus.on('elements.changed', () => {
      this.synchronize();
    });

    eventBus.on('table.destroy', () => {
      this.unsubscribeResult();
      this.unsubscribeInitialValues();
    });
  }

  private synchronize(): void {
    const errors = collectModelFeelErrors(
      this.state.getResult(),
      this.state.getInitialValues()
    );

    syncDmnFeelMarkers(
      this.renderer.getContainer(),
      errors
    );
  }

  static $inject = [
    'eventBus',
    'renderer'
  ];
}

const dmnFeelMarkersModule = {
  __init__: [
    'dmnFeelMarkersBehavior'
  ],

  dmnFeelMarkersBehavior: [
    'type',
    DmnFeelMarkersBehavior
  ]
};

export default dmnFeelMarkersModule;
