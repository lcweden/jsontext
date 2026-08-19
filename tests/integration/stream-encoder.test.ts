import Token from "#src/api/token";
import { JSONTextEncoderStream } from "#src/index";
import { decodeText } from "#src/utils/text";
import { assertEquals, assertRejects } from "#std/assert";

Deno.test("[integration] JSONTextEncoderStream", async (test) => {
  await test.step("should encode tokens to bytes", async () => {
    const stream = new JSONTextEncoderStream({ multiline: false });
    const chunks: Uint8Array[] = [];

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      await writer.write(Token.fromText("["));
      await writer.write(Token.fromNumber(1));
      await writer.write(Token.fromText("]"));
      await writer.close();
    })();

    for await (const chunk of stream.readable) {
      chunks.push(chunk);
    }

    await writing;

    const output = chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array());

    assertEquals(decodeText(output), "[1]");
  });

  await test.step("should error the stream on invalid token sequence", async () => {
    const stream = new JSONTextEncoderStream();

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      await writer.write(Token.fromText("{"));
      await writer.write(Token.fromNumber(42));
      await writer.close();
    })().catch(() => {});

    await assertRejects(async () => {
      for await (const _ of stream.readable) { /* drain */ }
    });

    await writing;
  });
});
