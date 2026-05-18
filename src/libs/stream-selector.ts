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

class JSONTextSelectorStream extends TransformStream<Uint8Array, Value> {
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
