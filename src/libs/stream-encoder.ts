import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import Encoder from "#src/modules/encoder";
import type Token from "#src/modules/token";
import type { EncoderOptions } from "#src/types/options";

type JSONTextEncoderStreamOptions = EncoderOptions & {
  writableStrategy?: QueuingStrategy<Token>;
  readableStrategy?: QueuingStrategy<Uint8Array>;
};

class JSONTextEncoderStream extends TransformStream<Token, Uint8Array> {
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
