import type { JSONTextDecoderOptions } from "#src/api/decoder";
import Token from "#src/api/token";
import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Parser from "#src/modules/parser";

/**
 * Options for {@link JSONTextDecoderStream}.
 *
 * @public
 */
type JSONTextDecoderStreamOptions = JSONTextDecoderOptions & {
  /** Queuing strategy for the writable side. */
  writableStrategy?: QueuingStrategy<Uint8Array>;
  /** Queuing strategy for the readable side. */
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
  #parser: Parser;

  /**
   * Creates a stream that decodes byte chunks into JSON tokens.
   *
   * @param options Decoder and queuing strategy options.
   */
  constructor(options: JSONTextDecoderStreamOptions = {}) {
    const { writableStrategy, readableStrategy, ...rest } = options;
    const decoderOptions = { ...DEFAULT_DECODER_OPTIONS, ...rest };

    super(
      {
        transform: (chunk, controller) => {
          this.#parser.push(chunk);
          this.#drain(controller);
        },
        flush: (controller) => {
          this.#parser.close();
          this.#drain(controller);
          this.#parser.checkEOF();
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#parser = new Parser(decoderOptions);
  }

  /** Drains all available tokens from the decoder into the readable side. */
  #drain(controller: TransformStreamDefaultController<Token>): void {
    for (let bytes; (bytes = this.#parser.readToken()) !== undefined;) {
      controller.enqueue(new Token(bytes));
    }
  }
}

export default JSONTextDecoderStream;
export type { JSONTextDecoderStreamOptions };
