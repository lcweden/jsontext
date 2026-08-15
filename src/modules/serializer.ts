import Token from "#src/api/token";
import Value from "#src/api/value";
import { ASCII, KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import Escaper from "#src/modules/escaper";
import Formatter from "#src/modules/formatter";
import type Pointer from "#src/modules/pointer";
import State from "#src/modules/state";
import Tape from "#src/modules/tape";
import { decodeText } from "#src/utils/text";

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
  /** Indentation string used per nesting level when multiline is enabled. Defaults to two spaces. */
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

/**
 * Low-level JSON serializer that writes tokens and values onto an internal
 * {@link Tape}, enforcing RFC 8259 structural rules and applying optional
 * formatting and escaping.
 *
 * @internal
 */
class Serializer {
  #escaper: Escaper;
  #formatter: Formatter;
  #options: SerializerOptions;
  #state: State;
  #tape: Tape;

  /**
   * Creates a new Serializer instance with the given options.
   *
   * @param options Serializer configuration options.
   */
  constructor(options: SerializerOptions) {
    this.#escaper = new Escaper(options);
    this.#formatter = new Formatter(options);
    this.#options = options;
    this.#state = new State(options);
    this.#tape = new Tape();
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
   * @param where `-1` for the previously processed value, `0` for the current scope, `1` for the next value.
   * @returns A {@link Pointer} representing the absolute path.
   */
  stackPointer(where: 0 | 1 | -1): Pointer {
    return this.#state.stackPointer(where);
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
   * @param token The {@link Token} to write.
   * @throws {SyntacticError} If the token is structurally invalid at the
   *   current position.
   */
  writeToken(token: Token): void {
    const length = this.#tape.length;
    const delimiter = this.#state.requiredDelimiter(token.kind);

    try {
      if (delimiter === ":") {
        this.#tape.appendByte(ASCII.COLON);
      } else if (delimiter === ",") {
        this.#tape.appendByte(ASCII.COMMA);
      }

      for (const bytes of this.#formatter.getWhitespace(token.kind, delimiter, this.#state.depth)) {
        this.#tape.appendBytes(bytes);
      }

      switch (token.kind) {
        case KIND.NULL:
          this.#tape.appendBytes(Token.NULL.bytes);
          this.#state.appendLiteral();
          break;
        case KIND.TRUE:
          this.#tape.appendBytes(Token.TRUE.bytes);
          this.#state.appendLiteral();
          break;
        case KIND.FALSE:
          this.#tape.appendBytes(Token.FALSE.bytes);
          this.#state.appendLiteral();
          break;
        case KIND.STRING: {
          const bytes = this.#escaper.escapeString(token.bytes);

          this.#tape.appendBytes(bytes);

          if (this.#state.needsObjectName) {
            const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
            const parsed = JSON.parse(decoded);

            this.#state.setLast(parsed);
          }

          this.#state.appendString();
          break;
        }
        case KIND.NUMBER: {
          const bytes = this.#escaper.canonicalizeNumber(token.bytes);

          this.#tape.appendBytes(bytes);
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
   * @param value The {@link Value} to write.
   * @throws {SyntacticError} If the value is structurally invalid at the
   *   current position.
   */
  writeValue(value: Value): void {
    const length = this.#tape.length;
    const delimiter = this.#state.requiredDelimiter(value.kind);

    try {
      if (delimiter === ":") {
        this.#tape.appendByte(ASCII.COLON);
      } else if (delimiter === ",") {
        this.#tape.appendByte(ASCII.COMMA);
      }

      for (const bytes of this.#formatter.getWhitespace(value.kind, delimiter, this.#state.depth)) {
        this.#tape.appendBytes(bytes);
      }

      let bytes = value.bytes;

      if (value.kind === KIND.STRING) {
        bytes = this.#escaper.escapeString(bytes);
      } else if (value.kind === KIND.NUMBER) {
        bytes = this.#escaper.canonicalizeNumber(bytes);
      }

      this.#tape.appendBytes(bytes);

      switch (value.kind) {
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
