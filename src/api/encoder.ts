import type Token from "#src/api/token";
import type Value from "#src/api/value";
import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import Serializer from "#src/modules/serializer";

/**
 * Options for {@link JSONTextEncoder} and {@link JSONTextEncoderStream}.
 *
 * @public
 */
type JSONTextEncoderOptions = {
  /** Allow duplicate object key names. Defaults to `false`. */
  allowDuplicateNames?: boolean;
  /** Allow invalid UTF-8 byte sequences. Defaults to `false`. */
  allowInvalidUTF8?: boolean;
  /** Normalize raw number tokens. Defaults to `false`. */
  canonicalizeRawNumbers?: boolean;
  /** Escape `<`, `>`, and `&` for HTML embedding. Defaults to `false`. */
  escapeForHTML?: boolean;
  /** Escape JavaScript line and paragraph separators. Defaults to `false`. */
  escapeForJS?: boolean;
  /** Indentation string used when `multiline` is enabled. Defaults to a tab. */
  indent?: string;
  /** Prefix added before each indented line. Defaults to an empty string. */
  indentPrefix?: string;
  /** Emit each value on its own line. Defaults to `true`. */
  multiline?: boolean;
  /** Emit a space after object `:` separators. Defaults to `true`. */
  spaceAfterColon?: boolean;
  /** Emit a space after array and object `,` separators. Defaults to `false`. */
  spaceAfterComma?: boolean;
};

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

  /**
   * Creates a new JSONTextEncoder instance with the given options.
   *
   * @param options Encoding options.
   */
  constructor(options?: JSONTextEncoderOptions) {
    this.#serializer = new Serializer({ ...DEFAULT_ENCODER_OPTIONS, ...options });
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#serializer.depth;
  }

  /** The byte offset of the end of the last token written. */
  get outputOffset(): number {
    return this.#serializer.outputOffset;
  }

  /** Resets the encoder, clearing its output buffer and structural state. */
  reset(): void {
    this.#serializer.reset();
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
   * @param where Relative position: `-1` previous, `0` current, or `1` next. Defaults to `1`.
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
   * @param token The token to encode.
   * @throws {SyntaxError} If the token is not valid at the current position.
   */
  writeToken(token: Token): void {
    this.#serializer.writeToken(token.kind, token.bytes);
  }

  /**
   * Encodes a complete {@link Value} and appends its bytes to the output
   * buffer.
   *
   * @param value The value to encode.
   * @throws {SyntaxError} If the value is not valid at the current position.
   */
  writeValue(value: Value): void {
    this.#serializer.writeValue(value.kind, value.bytes);
  }
}

export default JSONTextEncoder;
export type { JSONTextEncoderOptions };
