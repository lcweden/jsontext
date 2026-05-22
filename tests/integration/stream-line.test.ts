import { JSONTextLineStream } from "#src/index.ts";
import { encodeText } from "#src/utils/text.ts";
import { assertEquals } from "#std/assert";

Deno.test("[integration] JSONTextLineStream", async (test) => {
  await test.step("should emit one value per JSON line in JSONL input", async () => {
    const lines = ["null", "42", '"hello"', "{}", "[]"];
    const stream = new JSONTextLineStream();
    const values = [];

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      for (const line of lines) await writer.write(encodeText(line + "\n"));
      await writer.close();
    })().catch(() => {});

    for await (const value of stream.readable) {
      values.push(value);
    }

    await writing;

    assertEquals(values.length, lines.length);
  });

  await test.step("should emit values split across multiple chunks", async () => {
    const json = '{"a":1}{"b":2}{"c":3}';
    const chunkSize = 4;
    const stream = new JSONTextLineStream();
    const values = [];

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      for (let i = 0; i < json.length; i += chunkSize) {
        await writer.write(encodeText(json.slice(i, i + chunkSize)));
      }
      await writer.close();
    })().catch(() => {});

    for await (const value of stream.readable) {
      values.push(value);
    }

    await writing;

    assertEquals(values.length, 3);
  });

  await test.step("should emit a single value without trailing newline", async () => {
    const stream = new JSONTextLineStream();
    const values = [];

    const writing = (async () => {
      const writer = stream.writable.getWriter();
      await writer.write(encodeText("[1,2,3]"));
      await writer.close();
    })().catch(() => {});

    for await (const value of stream.readable) {
      values.push(value);
    }

    await writing;

    assertEquals(values.length, 1);
    assertEquals(values[0].json(), [1, 2, 3]);
  });
});
