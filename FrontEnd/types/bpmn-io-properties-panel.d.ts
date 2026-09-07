declare module '@bpmn-io/properties-panel' {
  export interface DebouncedFunction<
    TArgs extends unknown[],
    TResult
  > {
    (...args: TArgs): TResult;
    cancel?: () => void;
    flush?: () => void;
  }

  export type DebounceInput = <
    TArgs extends unknown[],
    TResult
  >(
    callback: (...args: TArgs) => TResult
  ) => DebouncedFunction<TArgs, TResult>;

  export interface SelectEntryOption {
    value: string;
    label: string;
  }

  export interface SelectEntryProps {
    element: unknown;
    id: string;
    label: string;
    getValue: () => string;
    setValue: (value: string) => void;
    getOptions: () => SelectEntryOption[];
    disabled?: boolean;
    description?: string;
  }

  export function Group(
    props: Record<string, unknown>
  ): unknown;

  export interface DescriptionEntryProps {
    element: unknown;
    forId: string;
    value?: string;
  }

  export function DescriptionEntry(
    props: DescriptionEntryProps
  ): unknown;

  export function SelectEntry(
    props: SelectEntryProps
  ): unknown;

  export interface TextFieldEntryProps {
    element: unknown;
    id: string;
    label: string;
    getValue: () => string;
    setValue: (
      value: string | undefined,
      error?: string
    ) => void;
    debounce: DebounceInput;
    validate?: (
      value: string | undefined
    ) => string | undefined;
    disabled?: boolean;
    description?: string;
  }

  export function TextFieldEntry(
    props: TextFieldEntryProps
  ): unknown;
}

declare module 'bpmn-js-properties-panel' {
  export function useService<T = unknown>(
    type: string,
    strict?: boolean
  ): T;
}
