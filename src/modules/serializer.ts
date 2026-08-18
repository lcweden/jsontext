import { ASCII, KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import type { Kind } from "#src/common/types";
import Escaper from "#src/modules/escaper";
import Formatter from "#src/modules/formatter";
import type Pointer from "#src/modules/pointer";
import State from "#src/modules/state";
import Tape from "#src/modules/tape";
import { decodeText, encodeText } from "#src/utils/text";

/** Options for {@link Serializer}. */
type SerializerOptions = {
  /** Allow duplicate object key names. By default, duplicate names throw a `SyntacticError`. */
  allowDuplicateNames: boolean;
  /** Allow invalid UTF-8 byte sequences. By default, invalid sequences throw a `TypeError`. */
  allowInvalidUTF8: boolean;
  /** Normalize number tokens to their canonical decimal form. */
  canonicalizeRawNumbers: boolean;
  /** Escape `<`, `>`, and `&` for safe embedding in HTML. */
  escapeForHTML: boolean;
  /** Escape `\u2028` and `\u2029` for safe embedding in JavaScript string literals. */
  escapeForJS: boolean;
  /** Indentation string used per nesting level when multiline is enabled. Defaults to a tab. */
  indent: string;
  /** Prefix prepended to every indented line when multiline is enabled. */
  indentPrefix: string;
  /** Emit each value on its own line with indentation. */
  multiline: boolean;
  /** Emit a space after each `:` separator in objects. */
  spaceAfterColon: boolean;
  /** Emit a space after each `,` separator in arrays and objects. */
  spaceAfterComma: boolean;
};

/** Low-level JSON serializer that writes tokens and values onto an internal {@link Tape}, enforcing RFC 8259 structural rules and applying optional formatting and escaping. */
class Serializer {
  #options: SerializerOptions;
  #escaper: Escaper;
  #formatter: Formatter;
  #state: State;
  #tape: Tape;
  #trueBytes: Uint8Array;
  #falseBytes: Uint8Array;
  #nullBytes: Uint8Array;

  /**
   * Creates a new Serializer instance with the given options.
   *
   * @param options Serializer configuration options.
   */
  constructor(options: SerializerOptions) {
    this.#options = options;
    this.#escaper = new Escaper(options);
    this.#formatter = new Formatter(options);
    this.#state = new State(options);
    this.#tape = new Tape();
    this.#trueBytes = encodeText(KIND.TRUE);
    this.#falseBytes = encodeText(KIND.FALSE);
    this.#nullBytes = encodeText(KIND.NULL);
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#state.depth;
  }

  /** The absolute output byte offset accumulated across all {@link takeBytes} calls since creation. */
  get outputOffset(): number {
    return this.#tape.outputOffset;
  }

  /**
   * Generates a JSON Pointer representing a location relative to the current
   * serialization position.
   *
   * @param where Relative position: `-1` previous, `0` current, or `1` next.
   * @returns A {@link Pointer} for the selected position.
   */
  stackPointer(where: 0 | 1 | -1): Pointer {
    return this.#state.stackPointer(where);
  }

  /** Resets the serializer to its initial state, clearing the output buffer and all structural state. */
  reset(): void {
    this.#state.reset();
    this.#tape.reset();
  }

  /**
   * Extracts the written bytes as a slice and advances the base output offset,
   * preparing the tape for the next chunk (streaming use).
   *
   * @returns A copy of the bytes written since the last `takeBytes` call.
   */
  takeBytes(): Uint8Array {
    return this.#tape.takeBytes();
  }

  /**
   * Serializes a single token onto the tape.
   *
   * Automatically inserts structural delimiters (`:` or `,`) and any
   * configured whitespace or indentation before the token. On error, the
   * tape is rolled back to its pre-call length.
   *
   * @param kind The {@link Kind} of token to write.
   * @param bytes Raw UTF-8 bytes of the token.
   * @throws {SyntacticError} If the token is invalid at the current position.
   */
  writeToken(kind: Kind, bytes: Uint8Array): void {
    const length = this.#tape.length;
    const delimiter = this.#state.requiredDelimiter(kind);

    try {
      if (delimiter === ":") {
        this.#tape.appendByte(ASCII.COLON);
      } else if (delimiter === ",") {
        this.#tape.appendByte(ASCII.COMMA);
      }

      for (const bytes of this.#formatter.getWhitespace(kind, delimiter, this.#state.depth)) {
        this.#tape.appendBytes(bytes);
      }

      switch (kind) {
        case KIND.NULL:
          this.#tape.appendBytes(this.#nullBytes);
          this.#state.appendLiteral();
          break;
        case KIND.TRUE:
          this.#tape.appendBytes(this.#trueBytes);
          this.#state.appendLiteral();
          break;
        case KIND.FALSE:
          this.#tape.appendBytes(this.#falseBytes);
          this.#state.appendLiteral();
          break;
        case KIND.STRING: {
          const escaped = this.#escaper.escapeString(bytes);

          this.#tape.appendBytes(escaped);

          if (this.#state.needsObjectName) {
            const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
            const parsed = JSON.parse(decoded);

            this.#state.setLast(parsed);
          }

          this.#state.appendString();
          break;
        }
        case KIND.NUMBER: {
          const escaped = this.#escaper.canonicalizeNumber(bytes);

          this.#tape.appendBytes(escaped);
          this.#state.appendNumber();
          break;
        }
        case KIND.OBJECT_BEGIN:
          this.#tape.appendByte(ASCII.OPENING_BRACE);
          this.#state.pushObject();
          break;
        case KIND.OBJECT_END:
          this.#tape.appendByte(ASCII.CLOSING_BRACE);
          this.#state.popObject();
          break;
        case KIND.ARRAY_BEGIN:
          this.#tape.appendByte(ASCII.OPENING_BRACKET);
          this.#state.pushArray();
          break;
        case KIND.ARRAY_END:
          this.#tape.appendByte(ASCII.CLOSING_BRACKET);
          this.#state.popArray();
          break;
      }
    } catch (error) {
      this.#tape.truncate(length);

      if (error instanceof SyntacticError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(1).toString();
        const offset = this.#tape.outputOffset;

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }
  }

  /**
   * Serializes a complete pre-parsed value onto the tape.
   *
   * Automatically inserts structural delimiters and any configured whitespace
   * before the value. On error, the tape is rolled back to its pre-call length.
   *
   * @param kind The {@link Kind} of value to write.
   * @param bytes Raw UTF-8 bytes of the complete value.
   * @throws {SyntacticError} If the value is invalid at the current position.
   */
  writeValue(kind: Kind, bytes: Uint8Array): void {
    const length = this.#tape.length;
    const delimiter = this.#state.requiredDelimiter(kind);

    try {
      if (delimiter === ":") {
        this.#tape.appendByte(ASCII.COLON);
      } else if (delimiter === ",") {
        this.#tape.appendByte(ASCII.COMMA);
      }

      for (const bytes of this.#formatter.getWhitespace(kind, delimiter, this.#state.depth)) {
        this.#tape.appendBytes(bytes);
      }

      if (kind === KIND.STRING) {
        bytes = this.#escaper.escapeString(bytes);
      } else if (kind === KIND.NUMBER) {
        bytes = this.#escaper.canonicalizeNumber(bytes);
      }

      this.#tape.appendBytes(bytes);

      switch (kind) {
        case KIND.NULL:
        case KIND.TRUE:
        case KIND.FALSE:
          this.#state.appendLiteral();
          break;
        case KIND.STRING: {
          if (this.#state.needsObjectName) {
            const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
            const parsed = JSON.parse(decoded);

            this.#state.setLast(parsed);
          }
          this.#state.appendString();
          break;
        }
        case KIND.NUMBER:
          this.#state.appendNumber();
          break;
        case KIND.OBJECT_BEGIN:
          this.#state.pushObject();
          this.#state.popObject();
          break;
        case KIND.ARRAY_BEGIN:
          this.#state.pushArray();
          this.#state.popArray();
          break;
      }
    } catch (error) {
      this.#tape.truncate(length);

      if (error instanceof SyntacticError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        const pointer = this.#state.stackPointer(1).toString();
        const offset = this.#tape.outputOffset;

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }
  }
}

export default Serializer;
export type { SerializerOptions };
