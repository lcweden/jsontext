import { DEFAULT_DECODER_OPTIONS, KIND } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import Path from "#src/modules/path";
import type Value from "#src/modules/value";
import type { DecoderOptions } from "#src/types/options";
import { encodeText } from "#src/utils/text";

type JSONTextSelectorStreamOptions = DecoderOptions & {
  writableStrategy?: QueuingStrategy<Uint8Array>;
  readableStrategy?: QueuingStrategy<Value>;
};

/**
 * A `TransformStream` that filters a JSON byte stream and emits only the
 * {@link Value} objects matching a JSONPath-like query.
 *
 * Writable side accepts raw JSON bytes. Readable side emits each matched
 * value in document order.
 *
 * This implementation supports a **subset** of JSONPath (RFC 9535):
 * **supported:**
 *
 * - Child Segment
 * - Descendant Segment
 * - Name Selector
 * - Wildcard Selector
 * - Index Selector
 * - Array Slice Selector
 *
 * @see https://www.rfc-editor.org/rfc/rfc9535
 * @example
 * const response = await fetch(url);
 * const values = response.body
 *   .pipeThrough(new JSONTextSelectorStream('$.items[*]'));
 */
class JSONTextSelectorStream extends TransformStream<Uint8Array, Value> {
  /**
   * @param query - A JSONPath-like query string.
   * @param options - Decoder and queuing strategy options.
   * @throws {SyntaxError} If `query` is not a valid query expression.
   */
  constructor(query: string, options?: JSONTextSelectorStreamOptions) {
    const { writableStrategy, readableStrategy, ...rest } = options ?? {};
    const decoder = new Decoder(new Uint8Array(), { ...DEFAULT_DECODER_OPTIONS, ...rest });
    const path = new Path(encodeText(query));

    super(
      {
        transform(chunk, controller) {
          try {
            decoder.push(chunk);

            while (true) {
              const kind = decoder.peekKind();

              if (kind === undefined) {
                break;
              }

              if (kind === KIND.OBJECT_END || kind === KIND.ARRAY_END) {
                decoder.readToken();

                continue;
              }

              const pointer = decoder.stackPointer(1);

              if (path.match(pointer.tokens)) {
                const value = decoder.readValue();

                if (value === undefined) {
                  break;
                }

                controller.enqueue(value);
              } else {
                if (decoder.readToken() === undefined) {
                  break;
                }
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush(controller) {
          try {
            decoder.end();

            while (true) {
              const kind = decoder.peekKind();

              if (kind === undefined) {
                break;
              }

              if (kind === KIND.OBJECT_END || kind === KIND.ARRAY_END) {
                decoder.readToken();

                continue;
              }

              const pointer = decoder.stackPointer(1);

              if (path.match(pointer.tokens)) {
                const value = decoder.readValue();

                if (value === undefined) {
                  break;
                }

                controller.enqueue(value);
              } else {
                if (decoder.readToken() === undefined) {
                  break;
                }
              }
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

export default JSONTextSelectorStream;
export type { JSONTextSelectorStreamOptions };
