import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import Encoder from "#src/modules/encoder";
import type Token from "#src/modules/token";
import type { EncoderOptions } from "#src/types/options";

type JSONTextEncoderStreamOptions = EncoderOptions & {
  writableStrategy?: QueuingStrategy<Token>;
  readableStrategy?: QueuingStrategy<Uint8Array>;
};

/**
 * A `TransformStream` that encodes a stream of {@link Token} objects into
 * a stream of `Uint8Array` byte chunks.
 *
 * Writable side accepts {@link Token} objects. Readable side emits the
 * corresponding JSON bytes, flushing output as tokens are written.
 *
 * @public
 * @example
 * ```javascript
 * const { readable, writable } = new JSONTextEncoderStream();
 * const writer = writable.getWriter();
 *
 * writer.write(Token.ARRAY_BEGIN);
 * writer.write(Token.fromNumber(1));
 * writer.write(Token.ARRAY_END);
 * writer.close();
 *
 * // or just pipe a token stream
 * ```
 */
class JSONTextEncoderStream extends TransformStream<Token, Uint8Array> {
  #encoder: Encoder;

  /**
   * @param options - Encoder and queuing strategy options.
   */
  constructor(options: JSONTextEncoderStreamOptions = {}) {
    const { writableStrategy, readableStrategy, ...rest } = options;
    const encoderOptions = { ...DEFAULT_ENCODER_OPTIONS, ...rest };

    super(
      {
        transform: (token, controller) => {
          this.#encoder.writeToken(token);
          this.#drain(controller);
        },
        flush: (controller) => {
          this.#drain(controller);
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#encoder = new Encoder(encoderOptions);
  }

  /**
   * Flushes accumulated bytes from the encoder into the readable side.
   */
  #drain(controller: TransformStreamDefaultController<Uint8Array>): void {
    const bytes = this.#encoder.takeBytes();

    if (bytes.length > 0) {
      controller.enqueue(bytes);
    }
  }
}

export default JSONTextEncoderStream;
export type { JSONTextEncoderStreamOptions };
