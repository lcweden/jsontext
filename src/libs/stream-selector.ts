import { DEFAULT_DECODER_OPTIONS, KIND, MAX_NESTING_DEPTH } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type { Matcher } from "#src/modules/path";
import Path from "#src/modules/path";
import Value from "#src/modules/value";
import type { DecoderOptions } from "#src/types/options";
import { encodeText } from "#src/utils/text";

/**
 * Options for {@link JSONTextSelectorStream}.
 *
 * @public
 */
type JSONTextSelectorStreamOptions = DecoderOptions & {
  /** Queuing strategy for the writable side. */
  writableStrategy?: QueuingStrategy<Uint8Array>;
  /** Queuing strategy for the readable side. */
  readableStrategy?: QueuingStrategy<Value>;
};

/**
 * A `TransformStream` that decodes a stream of `Uint8Array` byte chunks and
 * emits only the {@link Value} objects matched by a JSON Path expression.
 *
 * Writable side accepts raw JSON bytes. Readable side emits each {@link Value}
 * whose location in the document satisfies the path. Supports a subset of
 * RFC 9535 JSON Path syntax:
 *
 * - **Root Identifier**: `$`
 * - **Child Segment**: `.` or `[...]`
 * - **Descendant Segment**: `..`
 * - **Name Selector**: `.name` or `['name']`
 * - **Wildcard Selector**: `.*` or `[*]`
 * - **Index Selector (positive)**: `[1]`
 * - **Array Slice Selector (positive)**: `[0:5]` or `[::2]`
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535
 * @public
 * @example
 * ```javascript
 * const response = await fetch(url);
 * const items = response.body
 *   .pipeThrough(new JSONTextSelectorStream("$.items[*]"));
 * ```
 */
class JSONTextSelectorStream extends TransformStream<Uint8Array, Value> {
  #decoder: Decoder;
  #matcher: Matcher;
  #indexes: Uint32Array;
  #types: Uint8Array;
  #pushs: Uint8Array;
  #depth: number;

  /**
   * @param input - A JSON Path expression string (subset of RFC 9535) selecting which values to emit.
   * @param options - Decoder and queuing strategy options.
   * @throws {SyntaxError} If the path expression is invalid.
   */
  constructor(input: string, options: JSONTextSelectorStreamOptions = {}) {
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
    this.#matcher = new Path(encodeText(input)).createMatcher();
    this.#indexes = new Uint32Array(MAX_NESTING_DEPTH);
    this.#types = new Uint8Array(MAX_NESTING_DEPTH);
    this.#pushs = new Uint8Array(MAX_NESTING_DEPTH);
    this.#depth = 0;
  }

  /**
   * Reads decoder output step by step, advancing the path matcher, and
   * enqueues values at positions that satisfy the path.
   */
  #drain(controller: TransformStreamDefaultController<Value>): void {
    while (true) {
      const kind = this.#decoder.peekKind();

      if (kind === undefined) {
        break;
      }

      if (kind === KIND.OBJECT_END || kind === KIND.ARRAY_END) {
        this.#decoder.readToken();

        if (this.#depth > 0 && this.#pushs[this.#depth - 1] > 0) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          this.#depth--;

          if (this.#depth > 0) {
            const isObject = this.#types[this.#depth - 1] === 1;

            if (!isObject) {
              this.#indexes[this.#depth - 1]++;
            }
          }
        }

        continue;
      }

      if (this.#decoder.needObjectName()) {
        if (this.#decoder.readToken() === undefined) {
          return;
        }

        continue;
      }

      let pushed = false;

      if (this.#depth > 0) {
        const isObject = this.#types[this.#depth - 1] === 1;
        const step = isObject ? this.#decoder.lastObjectName() : this.#indexes[this.#depth - 1];

        this.#matcher.push(step);
        pushed = true;
      }

      const isContainer = kind === KIND.OBJECT_BEGIN || kind === KIND.ARRAY_BEGIN;

      if (this.#matcher.isAccepting()) {
        const value = this.#decoder.readValue();

        if (value === undefined) {
          if (pushed) {
            this.#matcher.pop();
          }

          return;
        }

        controller.enqueue(new Value(value.bytes, this.#decoder.stackPointer(-1).toString()));

        if (pushed) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          const isObject = this.#types[this.#depth - 1] === 1;

          if (!isObject) {
            this.#indexes[this.#depth - 1]++;
          }
        }

        continue;
      }

      if (!isContainer || this.#matcher.isDead()) {
        if (!this.#decoder.skipValue()) {
          if (pushed) {
            this.#matcher.pop();
          }

          return;
        }

        if (pushed) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          const isObject = this.#types[this.#depth - 1] === 1;

          if (!isObject) {
            this.#indexes[this.#depth - 1]++;
          }
        }

        continue;
      }

      this.#decoder.readToken();
      this.#types[this.#depth] = kind === KIND.OBJECT_BEGIN ? 1 : 0;
      this.#indexes[this.#depth] = 0;
      this.#pushs[this.#depth] = pushed ? 1 : 0;
      this.#depth++;
    }
  }
}

export default JSONTextSelectorStream;
export type { JSONTextSelectorStreamOptions };
