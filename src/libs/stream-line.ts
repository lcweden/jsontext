import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Value from "#src/modules/value";
import type { DecoderOptions } from "#src/types/options";

type JSONTextLineStreamOptions = DecoderOptions & {
  writableStrategy?: QueuingStrategy<Uint8Array>;
  readableStrategy?: QueuingStrategy<Value>;
};

class JSONTextLineStream extends TransformStream<Uint8Array, Value> {
  constructor(options?: JSONTextLineStreamOptions) {
    const { writableStrategy, readableStrategy, ...rest } = options ?? {};
    const decoder = new Decoder(new Uint8Array(), { ...DEFAULT_DECODER_OPTIONS, ...rest });

    super(
      {
        transform(chunk, controller) {
          try {
            decoder.push(chunk);

            let value;

            while ((value = decoder.readValue()) !== undefined) {
              controller.enqueue(value);
            }
          } catch (error) {
            controller.error(error);
          }
        },
        flush(controller) {
          try {
            decoder.end();

            let value;

            while ((value = decoder.readValue()) !== undefined) {
              controller.enqueue(value);
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

export default JSONTextLineStream;
export type { JSONTextLineStreamOptions };
