import {
  JSONTextDecoder,
  JSONTextDecoderStream,
  JSONTextEncoder,
  JSONTextEncoderStream,
  JSONTextSelectorStream,
  Token,
} from "#src/index";
import { decodeText } from "#src/utils/text";
import { assertEquals } from "#std/assert";

const HAR_URL = new URL("../../public/example.com.har", import.meta.url);

Deno.test("[e2e] round-trip", async (test) => {
  await test.step("should decode and re-encode example.com.har to semantically equivalent JSON", async () => {
    const bytes = await Deno.readFile(HAR_URL);
    const decoder = new JSONTextDecoder(bytes);
    const encoder = new JSONTextEncoder({ multiline: false, spaceAfterColon: false });

    decoder.end();

    let token;
    while ((token = decoder.readToken()) !== undefined) {
      encoder.writeToken(token);
    }

    decoder.checkEOF();

    assertEquals(
      JSON.parse(decodeText(encoder.bytes())),
      JSON.parse(decodeText(bytes)),
    );
  });

  await test.step("should round-trip example.com.har through stream pipeline", async () => {
    const chunks: Uint8Array[] = [];
    const file = await Deno.open(HAR_URL, { read: true });
    const stream = file.readable
      .pipeThrough(new JSONTextDecoderStream())
      .pipeThrough(new JSONTextEncoderStream({ multiline: false, spaceAfterColon: false }));

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const output = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;

    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    assertEquals(
      JSON.parse(decodeText(output)),
      JSON.parse(decodeText(await Deno.readFile(HAR_URL))),
    );
  });

  await test.step("should round-trip example.com.har through selector pipeline", async () => {
    const chunks: Uint8Array[] = [];
    const file = await Deno.open(HAR_URL, { read: true });
    const stream = file.readable
      .pipeThrough(new JSONTextSelectorStream("$..headers"))
      .pipeThrough(
        new TransformStream({
          start(controller) {
            controller.enqueue(Token.ARRAY_BEGIN);
          },
          transform(value, controller) {
            for (const token of value.tokens()) {
              controller.enqueue(token);
            }
          },
          flush(controller) {
            controller.enqueue(Token.ARRAY_END);
          },
        }),
      )
      .pipeThrough(new JSONTextEncoderStream({ multiline: true, spaceAfterColon: false }));

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const output = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;

    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    assertEquals(JSON.parse(decodeText(output)).length, 2);
  });
});
