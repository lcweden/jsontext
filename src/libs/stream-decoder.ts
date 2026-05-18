import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type { DecoderOptions } from "#src/types/options";

type JSONTextDecoderStreamOptions = DecoderOptions & {
  writableStrategy?: QueuingStrategy<Uint8Array>;
  readableStrategy?: QueuingStrategy<Token>;
};

class JSONTextDecoderStream extends TransformStream<Uint8Array, Token> {
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
