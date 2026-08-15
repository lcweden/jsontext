import type Token from "#src/api/token";
import type Value from "#src/api/value";
import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import type { SerializerOptions } from "#src/modules/serializer";
import Serializer from "#src/modules/serializer";

/** Options for {@link JSONTextEncoder}. */
type JSONTextEncoderOptions = Partial<SerializerOptions>;

/**
 * Low-level, stateful JSON encoder that produces bytes incrementally.
 *
 * Write tokens or values via {@link writeToken} / {@link writeValue}, then
 * retrieve the accumulated output with {@link takeBytes}. Call {@link reset} to
 * start a new document without creating a new instance.
 *
 * @public
 */
class JSONTextEncoder {
  #serializer: Serializer;
  #options: SerializerOptions;

  /**
   * Creates a new JSONTextEncoder instance with the given options.
   *
   * @param options - Encoding options.
   */
  constructor(options?: JSONTextEncoderOptions) {
    this.#options = { ...DEFAULT_ENCODER_OPTIONS, ...options };
    this.#serializer = new Serializer(this.#options);
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#serializer.depth;
  }

  /** The byte offset of the end of the last token written. */
  get outputOffset(): number {
    return this.#serializer.outputOffset;
  }

  /**
   * Resets the encoder to its initial state, clearing the output buffer and
   * all structural state.
   */
  reset(): void {
    this.#serializer = new Serializer(this.#options);
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
    return this.#serializer.stackPointer(where).toString();
  }

  /**
   * Drains and returns the bytes accumulated in the output buffer since the
   * last call. The internal buffer is cleared; structural state (nesting,
   * delimiters) is preserved so subsequent writes continue the same document.
   *
   * @returns A copy of the bytes written since the last `takeBytes` call.
   */
  takeBytes(): Uint8Array {
    return this.#serializer.takeBytes();
  }

  /**
   * Encodes a single {@link Token} and appends its bytes to the output buffer.
   *
   * @param token - The token to encode.
   * @throws {SyntacticError} If the token is not valid at the current position.
   */
  writeToken(token: Token): void {
    this.#serializer.writeToken(token);
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
    this.#serializer.writeValue(value);
  }
}

export default JSONTextEncoder;
export type { JSONTextEncoderOptions };
