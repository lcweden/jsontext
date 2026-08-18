/**
 * Thrown when invalid JSON syntax is encountered during decoding or encoding.
 *
 * The error message follows the format:
 * `"<message> within <pointer> at offset <offset>"`,
 * where `within <pointer>` is omitted when `pointer` is an empty string.
 */
class SyntacticError extends SyntaxError {
  #pointer: string;
  #offset: number;

  /**
   * @param message A human-readable description of the syntax error.
   * @param pointer JSON Pointer to the location in the document.
   * @param offset Byte offset at which the error was detected.
   */
  constructor(message: string, pointer: string, offset: number) {
    const within = pointer ? ` within ${pointer}` : "";
    const at = ` at offset ${offset}`;

    super(`${message}${within}${at}`);

    this.name = "SyntacticError";
    this.#pointer = pointer;
    this.#offset = offset;
  }

  /** JSON Pointer identifying the location of the syntax error. */
  get pointer(): string {
    return this.#pointer;
  }

  /** Byte offset at which the syntax error was detected. */
  get offset(): number {
    return this.#offset;
  }
}

export { SyntacticError };
