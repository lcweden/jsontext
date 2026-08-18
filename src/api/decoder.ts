import type { Kind } from "#src/api/kind";
import Token from "#src/api/token";
import Value from "#src/api/value";
import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Parser from "#src/modules/parser";

/**
 * Options for {@link JSONTextDecoder} and {@link JSONTextDecoderStream}.
 *
 * @public
 */
type JSONTextDecoderOptions = {
  /** Allow duplicate object key names. Defaults to `false`. */
  allowDuplicateNames?: boolean;
  /** Allow invalid UTF-8 byte sequences. Defaults to `false`. */
  allowInvalidUTF8?: boolean;
};

/**
 * Low-level, stateful JSON decoder that processes bytes incrementally.
 *
 * @public
 */
class JSONTextDecoder {
  #parser: Parser;

  /** Creates a decoder with the supplied options. */
  constructor(options?: JSONTextDecoderOptions) {
    this.#parser = new Parser({ ...DEFAULT_DECODER_OPTIONS, ...options });
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#parser.depth;
  }

  /** The absolute byte offset of the current input position. */
  get inputOffset(): number {
    return this.#parser.inputOffset;
  }

  /** The unconsumed bytes currently retained by the decoder. */
  get unreadBytes(): Uint8Array {
    return this.#parser.unreadBytes;
  }

  /** Verifies that the input is complete and contains no trailing characters. */
  checkEOF(): void {
    this.#parser.checkEOF();
  }

  /** Marks the input as complete so the decoder can validate its final token. */
  end(): void {
    this.#parser.close();
  }

  /** Appends a chunk of JSON bytes to the decoder. */
  push(bytes: Uint8Array): void {
    this.#parser.push(bytes);
  }

  /**
   * Peeks at the next token kind without consuming it.
   *
   * @returns The next {@link Kind}, or `undefined` when more input is needed.
   * @throws {SyntaxError} If the next bytes contain invalid JSON syntax.
   */
  peekKind(): Kind | undefined {
    return this.#parser.peekKind();
  }

  /** Resets the decoder, clearing buffered input and structural state. */
  reset(): void {
    this.#parser.reset();
  }

  /**
   * Reads the next JSON token.
   *
   * @returns A {@link Token}, or `undefined` when more input is needed.
   * @throws {SyntaxError} If the next token is invalid or violates the current structure.
   */
  readToken(): Token | undefined {
    const span = this.#parser.readToken();

    if (span === undefined) {
      return undefined;
    }

    return new Token(span);
  }

  /**
   * Reads the next complete JSON value.
   *
   * @returns A {@link Value}, or `undefined` when more input is needed.
   * @throws {SyntaxError} If the next value is invalid or violates the current structure.
   */
  readValue(): Value | undefined {
    const span = this.#parser.readValue();

    if (span === undefined) {
      return undefined;
    }

    return new Value(span);
  }

  /**
   * Skips the next complete JSON value without allocating a {@link Value}.
   *
   * @returns `true` when a value was skipped, or `false` when more input is needed.
   * @throws {SyntaxError} If the next value is invalid or violates the current structure.
   */
  skipValue(): boolean {
    return this.#parser.skipValue();
  }

  /**
   * Returns a JSON Pointer for a position relative to the current decoder state.
   *
   * @param where Relative position: `-1` previous, `0` current, or `1` next.
   * @returns A JSON Pointer string for the selected position.
   */
  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#parser.stackPointer(where).toString();
  }
}

export default JSONTextDecoder;
export type { JSONTextDecoderOptions };
