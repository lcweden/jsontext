import { ASCII, KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import Cursor from "#src/modules/cursor";
import type Pointer from "#src/modules/pointer";
import State from "#src/modules/state";
import Token from "#src/modules/token";
import Value from "#src/modules/value";
import type { Kind } from "#src/types/kind";
import type { DecoderOptions } from "#src/types/options";
import { normalize } from "#src/utils/kind";
import { decodeText } from "#src/utils/text";
import {
  consumeFalse,
  consumeNull,
  consumeNumber,
  consumeSimpleNumber,
  consumeSimpleString,
  consumeStringResumable,
  consumeTrue,
  consumeWhitespace,
} from "#src/utils/wire";

/**
 * Low-level streaming JSON decoder that reads UTF-8 encoded bytes,
 * navigates through them via a {@link Cursor}, and enforces RFC 8259
 * structural rules through a {@link State} machine.
 *
 * @internal
 */
class Decoder {
  #offset: number;
  #cursor: Cursor;
  #state: State;
  #options: DecoderOptions;

  /**
   * Creates a new Decoder with an initial byte buffer and options.
   *
   * @param bytes Initial UTF-8 bytes to decode.
   * @param options Decoder configuration options.
   */
  constructor(bytes: Uint8Array, options: DecoderOptions) {
    this.#offset = 0;
    this.#cursor = new Cursor(bytes);
    this.#state = new State(options);
    this.#options = options;
  }

  /**
   * Asserts that exactly one complete JSON value has been consumed with no
   * trailing content.
   *
   * @throws {SyntaxError} If the decoder is still inside a nested structure,
   *   or if non-whitespace characters remain after the value.
   */
  checkEOF(): void {
    if (this.#state.depth() > 1) {
      throw new SyntaxError(`Unexpected end of input`);
    }

    const position = consumeWhitespace(this.#cursor.bytes, this.#cursor.previousEnd);

    if (!this.#cursor.needMore(position)) {
      throw new SyntaxError(`Unexpected trailing characters at position ${position}`);
    }
  }

  /**
   * Returns the current nesting depth of the structural state.
   *
   * @returns The current nesting depth — `1` at the top level, incremented by each open object or array.
   */
  depth(): number {
    return this.#state.depth();
  }

  /**
   * Signals that no more bytes will arrive (end of stream).
   *
   * After calling this, number tokens no longer require a trailing byte to
   * confirm their end.
   */
  end(): void {
    this.#cursor.end();
  }

  /**
   * Returns the absolute byte offset at the end of the last consumed token.
   *
   * @returns The global byte offset from the start of the stream.
   */
  inputOffset(): number {
    return this.#cursor.previousOffsetEnd();
  }

  /**
   * Checks whether the current context expects an object key.
   *
   * @returns `true` if the next token must be a string serving as an object name, `false` otherwise.
   */
  needObjectName(): boolean {
    return this.#state.needObjectName();
  }

  /**
   * Returns the most recently consumed object key string.
   *
   * @returns The current object property name, or an empty string if not inside an object.
   */
  lastObjectName(): string {
    return this.#state.lastObjectName();
  }

  /**
   * Appends the next byte chunk from the stream to the input buffer.
   *
   * @param bytes The incoming UTF-8 bytes.
   */
  push(bytes: Uint8Array): void {
    this.#cursor.appendBytes(bytes);
  }

  /**
   * Peeks at the kind of the next token without consuming it.
   *
   * Skips leading whitespace and validates any required structural delimiter
   * (`","` or `":"`).
   * The result is cached until the next call to {@link readToken},
   * {@link readValue}, or {@link skipValue}.
   *
   * @returns The {@link Kind} of the next token, or `undefined` if more bytes are needed to determine it.
   * @throws {SyntacticError} If an invalid character or unexpected delimiter is encountered.
   */
  peekKind(): Kind | undefined {
    if (this.#cursor.peekPosition > 0) {
      if (this.#cursor.peekError) {
        throw this.#cursor.peekError;
      }

      const byte = this.#cursor.bytes[this.#cursor.peekPosition];
      const kind = normalize(byte);

      return kind;
    }

    this.#cursor.discardPrevious();

    let position = consumeWhitespace(this.#cursor.bytes, this.#cursor.previousEnd);
    let delimiter = null;

    if (this.#cursor.needMore(position)) {
      return undefined;
    }

    const byte = this.#cursor.bytes[position];

    if (byte === ASCII.COLON || byte === ASCII.COMMA) {
      delimiter = String.fromCharCode(byte);
      position++;
      position = consumeWhitespace(this.#cursor.bytes, position);

      if (this.#cursor.needMore(position)) {
        return undefined;
      }
    }

    const kind = normalize(this.#cursor.bytes[position]);

    if (!kind) {
      const message = `invalid character`;
      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#cursor.offsetAt(position);
      const error = new SyntacticError(message, pointer, offset);

      this.#cursor.peekError = error;

      throw error;
    }

    const expected = this.#state.needDelimiter(kind);

    if (expected !== delimiter) {
      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#cursor.offsetAt(position);
      const error = new SyntacticError("invalid delimiter", pointer, offset);

      this.#cursor.peekError = error;

      throw error;
    }

    this.#cursor.peekPosition = position;

    return kind;
  }

  /**
   * Resets the decoder to its initial state, discarding all buffered bytes
   * and structural state.
   */
  reset(): void {
    this.#offset = 0;
    this.#cursor = new Cursor(new Uint8Array());
    this.#state = new State(this.#options);
  }

  /**
   * Consumes and returns the next token from the input buffer.
   *
   * For structural tokens (`{`, `}`, `[`, `]`), the state machine is updated
   * accordingly. For string tokens that serve as object names, the name is
   * recorded in the state.
   *
   * @returns The next {@link Token}, or `undefined` if more bytes are needed.
   * @throws {SyntacticError} If the token is malformed or structurally invalid.
   */
  readToken(): Token | undefined {
    const kind = this.peekKind();

    if (kind === undefined) {
      return undefined;
    }

    const start = this.#cursor.peekPosition;
    let size = 0;

    try {
      switch (kind) {
        case KIND.NULL:
          size = this.#consumeNull(start);
          break;
        case KIND.TRUE:
          size = this.#consumeTrue(start);
          break;
        case KIND.FALSE:
          size = this.#consumeFalse(start);
          break;
        case KIND.STRING:
          size = this.#consumeString(start);
          break;
        case KIND.NUMBER:
          size = this.#consumeNumber(start);
          break;
        case KIND.OBJECT_BEGIN:
          size = this.#consumeObjectBegin();
          break;
        case KIND.OBJECT_END:
          size = this.#consumeObjectEnd();
          break;
        case KIND.ARRAY_BEGIN:
          size = this.#consumeArrayBegin();
          break;
        case KIND.ARRAY_END:
          size = this.#consumeArrayEnd();
          break;
      }
    } catch (error) {
      if (error instanceof SyntacticError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(0).toString();
        const offset = this.#cursor.offsetAt(start);

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }

    if (size === 0) {
      return undefined;
    }

    this.#cursor.peekPosition = 0;
    this.#cursor.previousStart = start;
    this.#cursor.previousEnd = start + size;

    return new Token(this.#cursor.previousBytes());
  }

  /**
   * Consumes and returns the next complete JSON value from the input buffer.
   *
   * For composite values (objects and arrays), the raw bytes are captured as
   * a single unit without entering the nested structure. For string values that
   * serve as object names, the name is recorded in the state.
   *
   * @returns The next {@link Value}, or `undefined` if more bytes are needed.
   * @throws {SyntacticError} If the value is malformed or structurally invalid.
   */
  readValue(): Value | undefined {
    const kind = this.peekKind();

    if (kind === undefined) {
      return undefined;
    }

    const start = this.#cursor.peekPosition;
    const size = this.#consumeValue(start);

    if (size === 0) {
      return undefined;
    }

    const bytes = this.#cursor.bytes.subarray(start, start + size);

    if (kind === KIND.OBJECT_BEGIN || kind === KIND.ARRAY_BEGIN) {
      try {
        JSON.parse(decodeText(bytes, !this.#options.allowInvalidUTF8));
      } catch (error) {
        if (error instanceof Error) {
          this.#cursor.peekError = error;
        }

        throw error;
      }
    }

    if (kind === KIND.STRING) {
      const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
      const parsed = JSON.parse(decoded);

      if (this.#state.needObjectName()) {
        this.#state.setLast(parsed);
      }

      this.#state.appendString();
    } else if (kind === KIND.NUMBER) {
      this.#state.appendNumber();
    } else {
      this.#state.appendLiteral();
    }

    this.#cursor.peekPosition = 0;
    this.#cursor.previousStart = start;
    this.#cursor.previousEnd = start + size;

    return new Value(bytes);
  }

  /**
   * Consumes the next complete JSON value without returning its bytes.
   *
   * @returns `true` if a value was consumed, `false` if more bytes are needed.
   * @throws {SyntacticError} If the value is malformed or structurally invalid.
   */
  skipValue(): boolean {
    const kind = this.peekKind();

    if (kind === undefined) {
      return false;
    }

    if (kind !== KIND.OBJECT_BEGIN && kind !== KIND.ARRAY_BEGIN) {
      return this.readToken() !== undefined;
    }

    const start = this.#cursor.peekPosition;
    const size = this.#consumeValue(start);

    if (size === 0) {
      return false;
    }

    this.#cursor.peekPosition = 0;
    this.#cursor.previousStart = start;
    this.#cursor.previousEnd = start + size;
    this.#state.appendLiteral();

    return true;
  }

  /**
   * Generates a JSON Pointer representing a location relative to the current
   * decoding position.
   *
   * @param where `-1` for the previously processed value, `0` for the current scope, `1` for the next value.
   * @returns A {@link Pointer} representing the absolute path.
   */
  stackPointer(where: 0 | 1 | -1 = 1): Pointer {
    return this.#state.stackPointer(where);
  }

  /**
   * Returns the unconsumed portion of the input buffer.
   *
   * @returns A subarray of bytes that have not yet been processed.
   */
  unreadBytes(): Uint8Array {
    return this.#cursor.unreadBytes();
  }

  #consumeValue(start: number): number {
    let position = start;
    const bytes = this.#cursor.bytes;
    const kind = normalize(bytes[position]);

    if (kind === KIND.NULL) {
      return consumeNull(bytes, position);
    }

    if (kind === KIND.TRUE) {
      return consumeTrue(bytes, position);
    }

    if (kind === KIND.FALSE) {
      return consumeFalse(bytes, position);
    }

    if (kind === KIND.STRING) {
      if (this.#offset === 0) {
        const size = consumeSimpleString(bytes, position);
        if (size > 0) return size;
      }

      const result = consumeStringResumable(
        bytes,
        position,
        this.#offset,
        !this.#options.allowInvalidUTF8,
      );

      if (!result.completed) {
        this.#offset = result.consumed;
        return 0;
      }

      this.#offset = 0;
      return result.consumed;
    }

    if (kind === KIND.NUMBER) {
      let size = consumeSimpleNumber(bytes, position);

      if (size === 0) {
        size = consumeNumber(bytes, position);
      }

      if (size > 0 && position + size === bytes.length && !this.#cursor.ended) {
        return 0;
      }

      return size;
    }

    if (kind === KIND.OBJECT_BEGIN || kind === KIND.ARRAY_BEGIN) {
      let depth = 0;
      let inString = false;
      let inEscape = false;

      while (position < bytes.length) {
        const byte = bytes[position];

        if (inString) {
          if (inEscape) {
            inEscape = false;
          } else if (byte === ASCII.BACKSLASH) {
            inEscape = true;
          } else if (byte === ASCII.QUOTE) {
            inString = false;
          }

          position++;

          continue;
        }

        if (byte === ASCII.QUOTE) {
          inString = true;
        } else if (byte === ASCII.OPENING_BRACE || byte === ASCII.OPENING_BRACKET) {
          depth++;
        } else if (byte === ASCII.CLOSING_BRACE || byte === ASCII.CLOSING_BRACKET) {
          depth--;

          if (depth === 0) {
            return position + 1 - start;
          }
        }

        position++;
      }

      return 0;
    }

    return 0;
  }

  #consumeNull(start: number): number {
    const size = consumeNull(this.#cursor.bytes, start);

    if (size === 0) {
      if (this.#cursor.bytes.length - start < 4) {
        return 0;
      }

      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#cursor.offsetAt(start);
      const error = new SyntacticError("invalid literal null", pointer, offset);

      throw error;
    }

    this.#state.appendLiteral();

    return size;
  }

  #consumeTrue(start: number): number {
    const size = consumeTrue(this.#cursor.bytes, start);

    if (size === 0) {
      if (this.#cursor.bytes.length - start < 4) {
        return 0;
      }

      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#cursor.offsetAt(start);
      const error = new SyntacticError("invalid literal true", pointer, offset);

      throw error;
    }

    this.#state.appendLiteral();

    return size;
  }

  #consumeFalse(start: number): number {
    const size = consumeFalse(this.#cursor.bytes, start);

    if (size === 0) {
      if (this.#cursor.bytes.length - start < 5) {
        return 0;
      }

      const pointer = this.#state.stackPointer(0).toString();
      const offset = this.#cursor.offsetAt(start);
      const error = new SyntacticError("invalid literal false", pointer, offset);

      throw error;
    }

    this.#state.appendLiteral();

    return size;
  }

  #consumeString(start: number): number {
    let size = 0;

    if (this.#offset === 0) {
      size = consumeSimpleString(this.#cursor.bytes, start);
    }

    if (size === 0) {
      const result = consumeStringResumable(
        this.#cursor.bytes,
        start,
        this.#offset,
        !this.#options.allowInvalidUTF8,
      );

      if (!result.completed) {
        this.#offset = result.consumed;
        return 0;
      }

      size = result.consumed;
      this.#offset = 0;
    }

    if (this.#state.needObjectName()) {
      const bytes = this.#cursor.bytes.subarray(start, start + size);
      const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
      const string = JSON.parse(decoded);

      this.#state.setLast(string);
    }

    this.#state.appendString();

    return size;
  }

  #consumeNumber(start: number): number {
    let size = consumeSimpleNumber(this.#cursor.bytes, start);

    if (size === 0) {
      size = consumeNumber(this.#cursor.bytes, start);

      if (size === 0) {
        return 0;
      }
    }

    if (start + size === this.#cursor.bytes.length && !this.#cursor.ended) {
      return 0;
    }

    this.#state.appendNumber();

    return size;
  }

  #consumeObjectBegin(): number {
    return (this.#state.pushObject(), 1);
  }

  #consumeObjectEnd(): number {
    return (this.#state.popObject(), 1);
  }

  #consumeArrayBegin(): number {
    return (this.#state.pushArray(), 1);
  }

  #consumeArrayEnd(): number {
    return (this.#state.popArray(), 1);
  }
}

export default Decoder;
