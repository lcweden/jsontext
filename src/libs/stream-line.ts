import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Value from "#src/modules/value";
import type { DecoderOptions } from "#src/types/options";

/**
 * Options for {@link JSONTextLineStream}.
 *
 * @public
 */
type JSONTextLineStreamOptions = DecoderOptions & {
  /** Queuing strategy for the writable side. */
  writableStrategy?: QueuingStrategy<Uint8Array>;
  /** Queuing strategy for the readable side. */
  readableStrategy?: QueuingStrategy<Value>;
};

/**
 * A `TransformStream` that decodes a stream of `Uint8Array` byte chunks into
 * a stream of complete {@link Value} objects.
 *
 * Each emitted value corresponds to one top-level JSON value in the input.
 * This makes `JSONTextLineStream` well-suited for processing newline-delimited
 * JSON (JSONL / JSON Lines) as well as any concatenated-JSON stream.
 *
 * @public
 * @example
 * ```javascript
 * const response = await fetch(url);
 * const values = response.body
 *   .pipeThrough(new JSONTextLineStream());
 * ```
 */
class JSONTextLineStream extends TransformStream<Uint8Array, Value> {
  #decoder: Decoder;

  /**
   * @param options - Decoder and queuing strategy options.
   */
  constructor(options: JSONTextLineStreamOptions = {}) {
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
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#decoder = new Decoder(new Uint8Array(), decoderOptions);
  }

  /**
   * Drains all available values from the decoder into the readable side.
   */
  #drain(controller: TransformStreamDefaultController<Value>): void {
    for (let value; (value = this.#decoder.readValue()) !== undefined;) {
      controller.enqueue(value);
    }
  }
}

export default JSONTextLineStream;
export type { JSONTextLineStreamOptions };
