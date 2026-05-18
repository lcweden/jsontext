import { KIND } from "#src/common/constants";
import { JSONTextDecoder } from "#src/index";
import { encodeText } from "#src/utils/text";
import { assertEquals } from "#std/assert";

Deno.test("[e2e] streaming readValue", async (test) => {
  await test.step("should parse a JSON array fed one byte at a time using readValue", () => {
    const json = JSON.stringify([{ "id": 1, "name": "Alice" }, 42, "hello", [1, 2]]);
    const bytes = encodeText(json);
    const decoder = new JSONTextDecoder();
    const values: string[] = [];
    let started = false;

    for (let i = 0; i < bytes.length; i++) {
      decoder.push(bytes.subarray(i, i + 1));

      if (i === bytes.length - 1) {
        decoder.end();
      }

      if (!started) {
        if (decoder.readToken() === undefined) {
          continue;
        }

        started = true;
      }

      while (true) {
        const kind = decoder.peekKind();

        if (kind === undefined) {
          break;
        }

        if (kind === KIND.ARRAY_END) {
          decoder.readToken();
          break;
        }

        const value = decoder.readValue();

        if (value === undefined) {
          break;
        }

        values.push(value.text());
      }
    }

    assertEquals(values.length, 4);
    assertEquals(values[0], '{"id":1,"name":"Alice"}');
    assertEquals(values[1], "42");
    assertEquals(values[2], '"hello"');
    assertEquals(values[3], "[1,2]");
  });
});
