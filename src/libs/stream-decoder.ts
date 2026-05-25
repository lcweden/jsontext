import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type { DecoderOptions } from "#src/types/options";

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
 * @public
 * @example
 * ```javascript
 * const response = await fetch(url);
 * const tokens = response.body
 *   .pipeThrough(new JSONTextDecoderStream());
 * ```
 */
class JSONTextDecoderStream extends TransformStream<Uint8Array, Token> {
  #decoder: Decoder;

  /**
   * @param options - Decoder and queuing strategy options.
   */
  constructor(options: JSONTextDecoderStreamOptions = {}) {
    const { writableStrategy, readableStrategy, ...rest } = options;
    const decoderOptions = { ...DEFAULT_DECODER_OPTIONS, ...rest };

    super(
      {
        transform: (chunk, controller) => {
          this.#decoder.push(chunk);
          this.#drain(controller);
        },
        flush: (controller) => {
          this.#decoder.end();
          this.#drain(controller);
          this.#decoder.checkEOF();
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#decoder = new Decoder(new Uint8Array(), decoderOptions);
  }

  /**
   * Drains all available tokens from the decoder into the readable side.
   */
  #drain(controller: TransformStreamDefaultController<Token>): void {
    for (let token; (token = this.#decoder.readToken()) !== undefined;) {
      controller.enqueue(token);
    }
  }
}

export default JSONTextDecoderStream;
export type { JSONTextDecoderStreamOptions };
