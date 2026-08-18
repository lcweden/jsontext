import { KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import type { Kind } from "#src/common/types";
import type Pointer from "#src/modules/pointer";
import Scanner from "#src/modules/scanner";
import State from "#src/modules/state";
import { decodeText } from "#src/utils/text";

/** Options for {@link Parser}. */
type ParserOptions = {
  /** Allow duplicate object key names. By default, duplicate names throw a `SyntacticError`. */
  allowDuplicateNames: boolean;
  /** Allow invalid UTF-8 byte sequences. By default, invalid sequences throw a `TypeError`. */
  allowInvalidUTF8: boolean;
};

/** Coordinates incremental JSON byte scanning with structural state validation. */
class Parser {
  #options: ParserOptions;
  #scanner: Scanner;
  #state: State;

  /** Creates a new parser with the supplied decoding options. */
  constructor(options: ParserOptions) {
    this.#options = options;
    this.#scanner = new Scanner();
    this.#state = new State(options);
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#state.depth;
  }

  /** The absolute byte offset of the current scanner position. */
  get inputOffset(): number {
    return this.#scanner.offset;
  }

  /** The most recently read object property name. */
  get lastObjectName(): string {
    return this.#state.lastObjectName;
  }

  /** Whether the current object context expects a property name. */
  get needObjectName(): boolean {
    return this.#state.needsObjectName;
  }

  /** The unconsumed bytes currently retained by the scanner. */
  get unreadBytes(): Uint8Array {
    return this.#scanner.unreadBytes;
  }

  /**
   * Verifies that the input is complete and contains no trailing characters.
   *
   * @throws {SyntaxError} If input ends inside a structure or contains trailing non-whitespace bytes.
   */
  checkEOF(): void {
    if (this.#state.depth > 1) {
      throw new SyntaxError("Unexpected end of input");
    }

    const offset = this.#scanner.findTrailingOffset();

    if (offset !== undefined) {
      throw new SyntaxError(`Unexpected trailing characters at position ${offset}`);
    }
  }

  /** Marks the input as complete so unterminated final tokens can be diagnosed. */
  close(): void {
    this.#scanner.close();
  }

  /**
   * Peeks at the next token kind without consuming it.
   *
   * @returns The next {@link Kind}, or `undefined` when more input is needed.
   * @throws {SyntacticError} If the next bytes contain invalid JSON syntax or delimiters.
   */
  peekKind(): Kind | undefined {
    try {
      if (!this.#scanner.peekNext()) {
        return undefined;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(0).toString();
        const offset = this.#scanner.offset;

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }

    const kind = this.#scanner.kind;

    if (!kind) {
      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#scanner.offset;

      throw new SyntacticError("Invalid character", pointer, offset);
    }

    const expected = this.#state.requiredDelimiter(kind);
    const delimiter = this.#scanner.delimiter;

    if (expected !== delimiter) {
      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#scanner.offset;

      throw new SyntacticError("Invalid delimiter", pointer, offset);
    }

    return kind;
  }

  /** Appends a chunk of JSON bytes to the input buffer. */
  push(bytes: Uint8Array): void {
    this.#scanner.appendBytes(bytes);
  }

  /**
   * Consumes the next JSON token.
   *
   * @returns The raw token bytes, or `undefined` when more input is needed.
   * @throws {SyntacticError} If the next token is invalid or violates the current structure.
   */
  readToken(): Uint8Array | undefined {
    const kind = this.peekKind();

    if (!kind) {
      return;
    }

    try {
      const consumed = this.#scanner.consumeToken(!this.#options.allowInvalidUTF8);

      if (!consumed) {
        return;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(0).toString();
        const offset = this.#scanner.offset;

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }

    switch (kind) {
      case KIND.NULL:
      case KIND.TRUE:
      case KIND.FALSE: {
        this.#state.appendLiteral();
        break;
      }
      case KIND.NUMBER: {
        this.#state.appendNumber();
        break;
      }
      case KIND.STRING: {
        if (this.#state.needsObjectName) {
          const text = decodeText(this.#scanner.span, !this.#options.allowInvalidUTF8);
          const json = JSON.parse(text);

          this.#state.setLast(json);
        }

        this.#state.appendString();
        break;
      }
      case KIND.OBJECT_BEGIN: {
        this.#state.pushObject();
        break;
      }
      case KIND.OBJECT_END: {
        this.#state.popObject();
        break;
      }
      case KIND.ARRAY_BEGIN: {
        this.#state.pushArray();
        break;
      }
      case KIND.ARRAY_END: {
        this.#state.popArray();
        break;
      }
    }

    return this.#scanner.span;
  }

  /**
   * Consumes the next complete JSON value.
   *
   * @returns The raw value bytes, or `undefined` when more input is needed.
   * @throws {SyntacticError} If the next value is invalid or violates the current structure.
   */
  readValue(): Uint8Array | undefined {
    if (!this.peekKind() || !this.skipValue()) {
      return;
    }

    return this.#scanner.span;
  }

  /** Resets the scanner and structural state to the initial state. */
  reset(): void {
    this.#scanner.reset();
    this.#state.reset();
  }

  /**
   * Consumes the next complete JSON value without returning its bytes.
   *
   * @returns `true` when a value was consumed, or `false` when more input is needed.
   * @throws {SyntacticError} If the next value is invalid or violates the current structure.
   */
  skipValue(): boolean {
    const kind = this.peekKind();

    if (!kind) {
      return false;
    }

    try {
      const isStructural = kind === KIND.OBJECT_BEGIN || kind === KIND.ARRAY_BEGIN;
      const consumed = isStructural
        ? this.#scanner.consumeValue()
        : this.#scanner.consumeToken(!this.#options.allowInvalidUTF8);

      if (!consumed) {
        return false;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(0).toString();
        const offset = this.#scanner.offset;

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }

    if (kind === KIND.STRING) {
      if (this.#state.needsObjectName) {
        const decoded = decodeText(this.#scanner.span, !this.#options.allowInvalidUTF8);
        const json = JSON.parse(decoded);

        this.#state.setLast(json);
      }

      this.#state.appendString();
    } else if (kind === KIND.NUMBER) {
      this.#state.appendNumber();
    } else {
      this.#state.appendLiteral();
    }

    return true;
  }

  /**
   * Returns a JSON Pointer for a position relative to the current parser state.
   *
   * @param where Relative position: `-1` previous, `0` current, or `1` next.
   * @returns A {@link Pointer} for the selected position.
   */
  stackPointer(where: 0 | 1 | -1 = 1): Pointer {
    return this.#state.stackPointer(where);
  }
}

export default Parser;
export type { ParserOptions };
