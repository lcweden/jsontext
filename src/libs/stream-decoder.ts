import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type { DecoderOptions } from "#src/types/options";

type JSONTextDecoderStreamOptions = DecoderOptions;

class JSONTextDecoderStream extends TransformStream<Uint8Array, Token> {
  constructor(options?: JSONTextDecoderStreamOptions) {
    const decoder = new Decoder(new Uint8Array(), { ...DEFAULT_DECODER_OPTIONS, ...options });

    super({
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
    });
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Token> {
    const reader = this.readable.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export default JSONTextDecoderStream;
export type { JSONTextDecoderStreamOptions };
