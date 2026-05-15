import { JSONTextDecoder, JSONTextEncoder } from "#src/index";
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
});
