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
 * @example
 * const { readable, writable } = new JSONTextEncoderStream();
 * const writer = writable.getWriter();
 * writer.write(Token.ARRAY_BEGIN);
 * writer.write(Token.fromNumber(1));
 * writer.write(Token.ARRAY_END);
 * writer.close();
 */
class JSONTextEncoderStream extends TransformStream<Token, Uint8Array> {
  /**
   * @param options - Encoder and queuing strategy options.
   */
  constructor(options?: JSONTextEncoderStreamOptions) {
    const { writableStrategy, readableStrategy, ...rest } = options ?? {};
    const encoder = new Encoder({ ...DEFAULT_ENCODER_OPTIONS, ...rest });

    super(
      {
        transform(token, controller) {
          try {
            encoder.writeToken(token);

            const bytes = encoder.takeBytes();

            if (bytes.length > 0) {
              controller.enqueue(bytes);
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush(controller) {
          try {
            const bytes = encoder.takeBytes();

            if (bytes.length > 0) {
              controller.enqueue(bytes);
            }
          } catch (error) {
            controller.error(error);
          }
        },
      },
      writableStrategy,
      readableStrategy,
    );
  }
}

export default JSONTextEncoderStream;
export type { JSONTextEncoderStreamOptions };
