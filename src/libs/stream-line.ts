import Value from "#src/api/value";
import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Parser from "#src/modules/parser";
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
  #parser: Parser;

  /**
   * @param options - Decoder and queuing strategy options.
   */
  constructor(options: JSONTextLineStreamOptions = {}) {
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
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#parser = new Parser(new Uint8Array(), decoderOptions);
  }

  /**
   * Drains all available values from the decoder into the readable side.
   */
  #drain(controller: TransformStreamDefaultController<Value>): void {
    for (let bytes; (bytes = this.#parser.readValue()) !== undefined;) {
      controller.enqueue(new Value(bytes));
    }
  }
}

export default JSONTextLineStream;
export type { JSONTextLineStreamOptions };
