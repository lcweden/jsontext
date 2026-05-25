import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import Encoder from "#src/modules/encoder";
import type Token from "#src/modules/token";
import type Value from "#src/modules/value";
import type { EncoderOptions } from "#src/types/options";

type JSONTextEncoderOptions = EncoderOptions;

/**
 * Low-level, stateful JSON encoder that produces bytes incrementally.
 *
 * Write tokens or values via {@link writeToken} / {@link writeValue}, then
 * retrieve the accumulated output with {@link bytes}. Call {@link reset} to
 * start a new document without creating a new instance.
 *
 * @public
 */
class JSONTextEncoder {
  #encoder: Encoder;

  /**
   * @param options - Encoding options.
   */
  constructor(options?: JSONTextEncoderOptions) {
    this.#encoder = new Encoder({ ...DEFAULT_ENCODER_OPTIONS, ...options });
  }

  /**
   * The current nesting depth — `1` at the top level, incremented by each
   * open object or array.
   *
   * @returns The current nesting depth — `1` at the top level, incremented by each open object or array.
   */
  depth(): number {
    return this.#encoder.depth();
  }

  /**
   * The byte offset of the end of the last token written, equal to the total
   * number of bytes produced so far.
   *
   * @returns The byte offset of the end of the last token written.
   */
  outputOffset(): number {
    return this.#encoder.outputOffset();
  }

  /**
   * Resets the encoder to its initial state, clearing the output buffer and
   * all structural state.
   */
  reset(): void {
    this.#encoder.reset();
  }

  /**
   * Returns a JSON Pointer string describing a position in the current
   * nesting context.
   *
   * | `where` | Meaning |
   * |---------|---------------------------------------------------------------|
   * | `1`     | The position of the **next** value to be written (default). |
   * | `0`     | The position of the **current** container. |
   * | `-1`    | The position of the **previously** written value. |
   *
   * @param where - Which position to return. Defaults to `1`.
   * @returns A JSON Pointer string, e.g. `"/foo/0"`.
   */
  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#encoder.stackPointer(where).toString();
  }

  /**
   * Drains and returns the bytes accumulated in the output buffer since the
   * last call. The internal buffer is cleared; structural state (nesting,
   * delimiters) is preserved so subsequent writes continue the same document.
   *
   * @returns A copy of the bytes written since the last `takeBytes` call.
   */
  takeBytes(): Uint8Array {
    return this.#encoder.takeBytes();
  }

  /**
   * Encodes a single {@link Token} and appends its bytes to the output buffer.
   *
   * @param token - The token to encode.
   * @throws {SyntacticError} If the token is not valid at the current position.
   */
  writeToken(token: Token): void {
    this.#encoder.writeToken(token);
  }

  /**
   * Encodes a complete {@link Value} and appends its bytes to the output
   * buffer.
   *
   * @param value - The value to encode.
   * @throws {SyntacticError} If the value is not valid at the current
   *   position.
   */
  writeValue(value: Value): void {
    this.#encoder.writeValue(value);
  }
}

export default JSONTextEncoder;
export type { JSONTextEncoderOptions };
