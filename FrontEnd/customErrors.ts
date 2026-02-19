
export class UnsupportedFeelError extends Error {
  constructor(node: string, expression: string) {
    if (!expression) {
      super('Expression is empty');
    }
    else {
      super(`Unsupported feel expression: ${node}`);
    }
    this.name = "UnsupportedFeelError";
  }
}

export class TranslationError extends Error {
  public error: any;
  constructor(errors: any, message: string = "") {
    if (message) {
      super(`There is an error in the translation`);
    } else {
      super("Error in decision table translation");
    }
    this.name = 'TranslationError';
    this.error = errors;
  }
}