import { ASCII, KIND, UNICODE } from "#src/common/constants.ts";
import { SyntacticError } from "#src/common/errors.ts";
import type Pointer from "#src/modules/pointer.ts";
import State from "#src/modules/state.ts";
import Tape from "#src/modules/tape.ts";
import Token from "#src/modules/token.ts";
import Value from "#src/modules/value.ts";
import type { Kind } from "#src/types/kind.ts";
import type { EncoderOptions } from "#src/types/options.ts";
import { decodeText, encodeText } from "#src/utils/text.ts";

class Encoder {
  #tape: Tape;
  #state: State;
  #options: EncoderOptions;
  #cache: Record<string, Uint8Array | null>;

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

  bytes(): Uint8Array {
    return this.#tape.bytes();
  }

  depth(): number {
    return this.#state.depth();
  }

  outputOffset(): number {
    return this.#tape.outputOffset();
  }

  reset(): void {
    this.#tape.reset();
    this.#state = new State(this.#options);
  }

  stackPointer(where: 0 | 1 | -1): Pointer {
    return this.#state.stackPointer(where);
  }

  takeBytes(): Uint8Array {
    return this.#tape.takeBytes();
  }

  writeToken(token: Token): void {
    const length = this.#tape.length;
    const delimiter = this.#state.needDelimiter(token.kind);

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

          if (this.#state.needObjectName()) {
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

  writeValue(value: Value): void {
    const length = this.#tape.length;
    const delimiter = this.#state.needDelimiter(value.kind);

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
          if (this.#state.needObjectName()) {
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
      const depth = this.#state.depth();

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
