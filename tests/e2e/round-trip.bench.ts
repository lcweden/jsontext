import {
  JSONTextDecoder,
  JSONTextDecoderStream,
  JSONTextEncoder,
  JSONTextEncoderStream,
} from "#src/index";

const HAR_URL = new URL("../../public/example.com.har", import.meta.url);
const bytes = await Deno.readFile(HAR_URL);

Deno.bench({
  name: "pull",
  group: "round-trip",
  baseline: true,
  fn() {
    const decoder = new JSONTextDecoder(bytes);
    const encoder = new JSONTextEncoder({ multiline: false, spaceAfterColon: false });

    decoder.end();

    let token;
    while ((token = decoder.readToken()) !== undefined) {
      encoder.writeToken(token);
    }

    decoder.checkEOF();
  },
});

Deno.bench({
  name: "stream",
  group: "round-trip",
  async fn() {
    const inputStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });

    const outputStream = inputStream
      .pipeThrough(new JSONTextDecoderStream())
      .pipeThrough(new JSONTextEncoderStream({ multiline: false, spaceAfterColon: false }));

    for await (const _ of outputStream) {
      // drain
    }
  },
});
