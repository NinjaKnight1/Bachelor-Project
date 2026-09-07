import type {
  DmnFeelSource,
  ModelFeelSource
} from '../modelFeelAnalysis';

import type {
  ModelFeelError
} from '../modelFeelErrors';

const ERROR_CLASS = 'model-feel-dmn-error';

function isDmnFeelSource(
  source: ModelFeelSource
): source is DmnFeelSource {
  return source.origin.startsWith('dmn-');
}

function findMarkerElement(
  container: Element,
  source: DmnFeelSource
): Element | undefined {
  const attribute =
    source.origin === 'dmn-input-header' ||
    source.origin === 'dmn-output-header'
      ? 'data-col-id'
      : 'data-element-id';

  const markerElementId =
    source.markerElementId ??
    source.elementId;

  return Array.from(
    container.querySelectorAll(`[${attribute}]`)
  ).find(
    element =>
      element.getAttribute(attribute) ===
      markerElementId
  );
}

function clearMarkers(container: Element): void {
  container
    .querySelectorAll(`.${ERROR_CLASS}`)
    .forEach(element => {
      element.classList.remove(ERROR_CLASS);
      element.removeAttribute('aria-invalid');
      element.removeAttribute('title');
    });
}

export function syncDmnFeelMarkers(
  container: Element,
  errors: ModelFeelError[]
): void {
  clearMarkers(container);

  const messagesByElement =
    new Map<Element, Set<string>>();

  const addMarker = (
    source: ModelFeelSource,
    message: string
  ): void => {
    if (!isDmnFeelSource(source)) {
      return;
    }

    const element =
      findMarkerElement(container, source);

    if (!element) {
      return;
    }

    const messages =
      messagesByElement.get(element) ??
      new Set<string>();

    messages.add(message);
    messagesByElement.set(element, messages);
  };

  errors.forEach(error => {
    if (error.kind === 'feel') {
      addMarker(error.source, error.message);
      return;
    }

    if (error.kind === 'conflict') {
      error.sources.forEach(source => {
        addMarker(source, error.message);
      });
    }
  });

  messagesByElement.forEach(
    (messages, element) => {
      element.classList.add(ERROR_CLASS);
      element.setAttribute(
        'aria-invalid',
        'true'
      );
      element.setAttribute(
        'title',
        Array.from(messages).join('\n')
      );
    }
  );
}
