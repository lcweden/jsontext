import { KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import type Pointer from "#src/modules/pointer";
import Scanner from "#src/modules/scanner";
import State from "#src/modules/state";
import type { Kind } from "#src/types/kind";
import { decodeText } from "#src/utils/text";

/** Options for {@link Parser}. */
type ParserOptions = {
  /** Allow duplicate object key names. By default, duplicate names throw a `SyntacticError`. */
  allowDuplicateNames: boolean;
  /** Allow invalid UTF-8 byte sequences. By default, invalid sequences throw a `TypeError`. */
  allowInvalidUTF8: boolean;
};

class Parser {
  #options: ParserOptions;
  #scanner: Scanner;
  #state: State;

  constructor(bytes: Uint8Array, options: ParserOptions) {
    this.#options = options;
    this.#scanner = new Scanner(bytes);
    this.#state = new State(options);
  }

  get depth(): number {
    return this.#state.depth;
  }

  get inputOffset(): number {
    return this.#scanner.offset;
  }

  get lastObjectName(): string {
    return this.#state.lastObjectName;
  }

  get needObjectName(): boolean {
    return this.#state.needsObjectName;
  }

  get unreadBytes(): Uint8Array {
    return this.#scanner.unreadBytes;
  }

  checkEOF(): void {
    if (this.#state.depth > 1) {
      throw new SyntaxError("Unexpected end of input");
    }

    const offset = this.#scanner.findTrailingOffset();

    if (offset !== undefined) {
      throw new SyntaxError(`Unexpected trailing characters at position ${offset}`);
    }
  }

  close(): void {
    this.#scanner.close();
  }

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

  push(bytes: Uint8Array): void {
    this.#scanner.appendBytes(bytes);
  }

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

  readValue(): Uint8Array | undefined {
    if (!this.peekKind() || !this.skipValue()) {
      return;
    }

    return this.#scanner.span;
  }

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

  stackPointer(where: 0 | 1 | -1 = 1): Pointer {
    return this.#state.stackPointer(where);
  }
}

export default Parser;
export type { ParserOptions };
