import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants.ts";
import Decoder from "#src/modules/decoder.ts";
import type Token from "#src/modules/token.ts";
import type { DecoderOptions } from "#src/types/options.ts";

type JSONTextDecoderStreamOptions = DecoderOptions & {
  writableStrategy?: QueuingStrategy<Uint8Array>;
  readableStrategy?: QueuingStrategy<Token>;
};

/**
 * A `TransformStream` that decodes a stream of `Uint8Array` byte chunks into
 * a stream of {@link Token} objects.
 *
 * Writable side accepts raw JSON bytes (possibly split across multiple chunks).
 * Readable side emits one {@link Token} per JSON token in document order.
 *
 * @example
 * const response = await fetch(url);
 * const tokens = response.body
 *   .pipeThrough(new JSONTextDecoderStream());
 */
class JSONTextDecoderStream extends TransformStream<Uint8Array, Token> {
  /**
   * @param options - Decoder and queuing strategy options.
   */
  constructor(options: JSONTextDecoderStreamOptions = {}) {
    const { writableStrategy, readableStrategy, ...rest } = options;
    const decoderOptions = { ...DEFAULT_DECODER_OPTIONS, ...rest };
    const decoder = new Decoder(new Uint8Array(), decoderOptions);

    super(
      {
        transform(chunk, controller) {
          try {
            decoder.push(chunk);

            let token;

            while ((token = decoder.readToken()) !== undefined) {
              controller.enqueue(token);
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush(controller) {
          try {
            decoder.end();

            let token;

            while ((token = decoder.readToken()) !== undefined) {
              controller.enqueue(token);
            }

            decoder.checkEOF();
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

export default JSONTextDecoderStream;
export type { JSONTextDecoderStreamOptions };
