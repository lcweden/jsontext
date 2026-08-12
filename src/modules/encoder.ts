import Token from "#src/api/token";
import Value from "#src/api/value";
import { ASCII, KIND, UNICODE } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import type Pointer from "#src/modules/pointer";
import State from "#src/modules/state";
import Tape from "#src/modules/tape";
import type { Kind } from "#src/types/kind";
import type { EncoderOptions } from "#src/types/options";
import { decodeText, encodeText } from "#src/utils/text";

/**
 * Low-level JSON encoder that serializes tokens and values onto an internal
 * {@link Tape}, enforcing RFC 8259 structural rules and applying optional
 * formatting (indentation, HTML escaping, etc.).
 *
 * @internal
 */
class Encoder {
  #tape: Tape;
  #state: State;
  #options: EncoderOptions;
  #cache: Record<string, Uint8Array | null>;

  /**
   * Creates a new Encoder with the given options.
   *
   * @param options Encoder configuration options.
   */
  constructor(options: EncoderOptions) {
    this.#tape = new Tape();
    this.#state = new State(options);
    this.#options = options;
    this.#cache = {
      "null_bytes": encodeText("null"),
      "true_bytes": encodeText("true"),
      "false_bytes": encodeText("false"),
      "indent_bytes": encodeText(options.indent ?? "\t"),
      "indent_prefix_bytes": options.indentPrefix ? encodeText(options.indentPrefix) : null,
    };
  }

  /**
   * Returns a view of the bytes written so far without advancing the output offset.
   *
   * @returns A subarray of the internal tape buffer.
   */
  bytes(): Uint8Array {
    return this.#tape.bytes();
  }

  /**
   * Returns the current structural nesting depth.
   *
   * @returns The current nesting depth — `1` at the top level, incremented by each open object or array.
   */
  depth(): number {
    return this.#state.depth;
  }

  /**
   * Returns the absolute output byte offset, accumulating across all
   * {@link takeBytes} calls since the last {@link reset}.
   *
   * @returns The absolute output byte offset.
   */
  outputOffset(): number {
    return this.#tape.outputOffset();
  }

  /**
   * Clears the tape and reinitializes the structural state.
   */
  reset(): void {
    this.#tape.reset();
    this.#state = new State(this.#options);
  }

  /**
   * Generates a JSON Pointer representing a location relative to the current
   * encoding position.
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

      this.#appendWhitespace(token.kind, delimiter);

      switch (token.kind) {
        case KIND.NULL:
          this.#tape.appendBytes(this.#cache.null_bytes!);
          this.#state.appendLiteral();
          break;
        case KIND.TRUE:
          this.#tape.appendBytes(this.#cache.true_bytes!);
          this.#state.appendLiteral();
          break;
        case KIND.FALSE:
          this.#tape.appendBytes(this.#cache.false_bytes!);
          this.#state.appendLiteral();
          break;
        case KIND.STRING: {
          const bytes = this.#encodeText(token.bytes);

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
          let bytes = token.bytes;

          if (this.#options.canonicalizeRawNumbers) {
            const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
            const parsed = JSON.parse(decoded);
            const encoded = encodeText(String(parsed));

            bytes = encoded;
          }

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
        const offset = this.#tape.outputOffset();

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

      this.#appendWhitespace(value.kind, delimiter);

      let bytes = value.bytes;

      if (value.kind === KIND.STRING) {
        bytes = this.#encodeText(bytes);
      } else if (value.kind === KIND.NUMBER && this.#options.canonicalizeRawNumbers) {
        const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
        const parsed = JSON.parse(decoded);
        const encoded = encodeText(String(parsed));

        bytes = encoded;
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
        const offset = this.#tape.outputOffset();

        throw new SyntacticError(error.message, pointer, offset);
      }

      throw error;
    }
  }

  #appendWhitespace(kind: Kind, delimiter: ":" | "," | null): void {
    if (delimiter === ":") {
      if (this.#options.spaceAfterColon) {
        this.#tape.appendByte(ASCII.SPACE);
      }

      return;
    }

    if (delimiter === "," && this.#options.spaceAfterComma) {
      this.#tape.appendByte(ASCII.SPACE);
    }

    if (this.#options.multiline) {
      const depth = this.#state.depth;

      if (depth === 1) {
        return;
      }

      const isClose = kind === KIND.OBJECT_END || kind === KIND.ARRAY_END;
      const levels = isClose ? depth - 2 : depth - 1;

      this.#tape.appendByte(ASCII.LINE_FEED);

      if (this.#options.indentPrefix && this.#cache["indent_prefix_bytes"]) {
        this.#tape.appendBytes(this.#cache["indent_prefix_bytes"]);
      }

      for (let i = 0; i < levels; i++) {
        if (this.#cache["indent_bytes"]) {
          this.#tape.appendBytes(this.#cache["indent_bytes"]);
        }
      }
    }
  }

  #encodeText(bytes: Uint8Array): Uint8Array {
    if (!this.#options.escapeForHTML && !this.#options.escapeForJS) {
      if (!this.#options.allowInvalidUTF8) {
        decodeText(bytes, true);
      }

      return bytes;
    }

    const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
    const parsed = JSON.parse(decoded);
    let encoded = JSON.stringify(parsed);

    if (this.#options.escapeForHTML) {
      encoded = encoded.replace(
        new RegExp("[<>&]", "g"),
        (substring) => {
          return (substring === "<"
            ? UNICODE.OPEN_ANGLED_BRACKET
            : substring === ">"
            ? UNICODE.CLOSE_ANGLED_BRACKET
            : UNICODE.AMPERSAND);
        },
      );
    }

    if (this.#options.escapeForJS) {
      encoded = encoded
        .replace(new RegExp("\\u2028", "g"), UNICODE.LINE_SEPARATOR)
        .replace(new RegExp("\\u2029", "g"), UNICODE.PARAGRAPH_SEPARATOR);
    }

    return encodeText(encoded);
  }
}

export default Encoder;
