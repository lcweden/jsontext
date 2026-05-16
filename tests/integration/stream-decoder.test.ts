import { JSONTextDecoderStream } from "#src/index";
import type Token from "#src/modules/token";
import { encodeText } from "#src/utils/text";
import { assertEquals, assertRejects } from "#std/assert";

Deno.test("[integration] JSONTextDecoderStream", async (test) => {
  await test.step("should emit a number token deferred to flush", async () => {
    const stream = new JSONTextDecoderStream();
    const tokens: Token[] = [];

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      for (const chunk of [encodeText("42")]) await writer.write(chunk);
      await writer.close();
    })().catch(() => {});

    for await (const token of stream) {
      tokens.push(token);
    }

    await writing;

    assertEquals(tokens.length, 1);
  });

  await test.step("should error the stream on invalid JSON", async () => {
    const stream = new JSONTextDecoderStream();

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      for (const chunk of [encodeText("{invalid}")]) await writer.write(chunk);
      await writer.close();
    })().catch(() => {});

    await assertRejects(async () => {
      for await (const _ of stream) { /* drain */ }
    });

    await writing;
  });

  await test.step("should error the stream on truncated JSON", async () => {
    const stream = new JSONTextDecoderStream();

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      for (const chunk of [encodeText('{"a":1')]) await writer.write(chunk);
      await writer.close();
    })().catch(() => {});

    await assertRejects(async () => {
      for await (const _ of stream) { /* drain */ }
    });

    await writing;
  });
});
