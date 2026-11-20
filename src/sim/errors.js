// Thrown for malformed --inputs / --scenario files. The CLI maps it to exit code 2.
export class FormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormatError';
  }
}
