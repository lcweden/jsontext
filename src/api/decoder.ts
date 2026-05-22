import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants.ts";
import Decoder from "#src/modules/decoder.ts";
import type Token from "#src/modules/token.ts";
import type Value from "#src/modules/value.ts";
import type { Kind } from "#src/types/kind.ts";
import type { DecoderOptions } from "#src/types/options.ts";

type JSONTextDecoderOptions = DecoderOptions;

/**
 * Low-level, stateful JSON decoder that processes input incrementally.
 *
 * Feed byte chunks via {@link push} then consume tokens with
 * {@link readToken} / {@link readValue} / {@link skipValue}.
 * Call {@link end} when the stream is exhausted to flush any buffered state.
 */
class JSONTextDecoder {
  #decoder: Decoder;

  /**
   * @param bytes - Initial bytes to pre-load into the decoder.
   * @param options - Decoding options.
   */
  constructor(bytes: Uint8Array = new Uint8Array(), options?: JSONTextDecoderOptions) {
    this.#decoder = new Decoder(bytes, { ...DEFAULT_DECODER_OPTIONS, ...options });
  }

  /**
   * Asserts that the input has been fully consumed.
   *
   * @throws {SyntacticError} If there are unread bytes remaining.
   */
  checkEOF(): void {
    this.#decoder.checkEOF();
  }

  /**
   * The current nesting depth — `0` at top level, incremented inside each
   * object or array.
   */
  depth(): number {
    return this.#decoder.depth();
  }

  /**
   * Signals that no more input will be pushed.
   *
   * Validates that any incomplete value is properly terminated.
   *
   * @throws {SyntacticError} If the input ends in the middle of a value.
   */
  end(): void {
    this.#decoder.end();
  }

  /**
   * The byte offset of the next unread byte within the total input seen so far.
   *
   * @returns The byte offset of the next unread byte, or the total length of all
   */
  inputOffset(): number {
    return this.#decoder.inputOffset();
  }

  /**
   * Appends a chunk of bytes to the internal buffer.
   *
   * @param bytes - The next chunk of JSON-encoded bytes.
   */
  push(bytes: Uint8Array): void {
    this.#decoder.push(bytes);
  }

  /**
   * Returns the {@link Kind} of the next token without consuming it,
   * or `undefined` if no complete token is available yet.
   *
   * @returns The {@link Kind} of the next token, or `undefined` if no complete token is available yet.
   */
  peekKind(): Kind | undefined {
    return this.#decoder.peekKind();
  }

  /**
   * Resets the decoder to its initial state, discarding all buffered input
   * and state.
   */
  reset(): void {
    this.#decoder.reset();
  }

  /**
   * Reads and returns the next {@link Token} from the buffer, or `undefined`
   * if no complete token is available yet.
   *
   * @returns The next token, or `undefined` if no complete token is available yet.
   * @throws {SyntacticError} If invalid JSON syntax is encountered.
   */
  readToken(): Token | undefined {
    return this.#decoder.readToken();
  }

  /**
   * Reads and returns the next complete {@link Value} from the buffer, or
   * `undefined` if there is not yet enough input to form a complete value.
   *
   * @returns The next value, or `undefined` if no complete value is available yet.
   * @throws {SyntacticError} If invalid JSON syntax is encountered.
   */
  readValue(): Value | undefined {
    return this.#decoder.readValue();
  }

  /**
   * Skips over the next complete value without returning it.
   *
   * @returns `true` if a value was skipped, `false` if no complete value was available yet.
   * @throws {SyntacticError} If invalid JSON syntax is encountered.
   */
  skipValue(): boolean {
    return this.#decoder.skipValue();
  }

  /**
   * Returns a JSON Pointer string describing a position in the current
   * nesting context.
   *
   * | `where` | Meaning |
   * |---------|-------------------------------------------------------------------|
   * | `1`     | The position of the **next** value to be read (default). |
   * | `0`     | The position of the **current** container. |
   * | `-1`    | The position of the **previously** read value. |
   *
   * @param where - Which position to return. Defaults to `1`.
   * @returns A JSON Pointer string, e.g. `"/foo/0"`.
   */
  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#decoder.stackPointer(where).toString();
  }

  /**
   * Returns a view of the bytes in the internal buffer that have not yet been
   * consumed.
   *
   * @returns A `Uint8Array` view of the unread bytes in the internal buffer.
   */
  unreadBytes(): Uint8Array {
    return this.#decoder.unreadBytes();
  }
}

export default JSONTextDecoder;
export type { JSONTextDecoderOptions };
