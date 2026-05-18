import { JSONTextDecoderStream } from "#src/index";
import { assert } from "#std/assert";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const FIXTURE_BASE = "https://github.com/lcweden/jsontext/releases/download/fixtures";

Deno.test("[e2e] streaming", async (test) => {
  await test.step("[fixture] json_bus.json.gz", async (test) => {
    await test.step("should stream 75 MB without error", async () => {
      const input = `${FIXTURE_BASE}/json_bus.json.gz`;
      const headers = new Headers({ "Accept": "application/octet-stream" });

      if (GITHUB_TOKEN) {
        headers.set("Authorization", `Bearer ${GITHUB_TOKEN}`);
      }

      const response = await fetch(input, { headers });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch fixture: ${response.statusText}`);
      }

      const decompresser = new DecompressionStream("gzip");
      const decoder = new JSONTextDecoderStream();
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let tokenCount = 0;

      for await (const _ of stream) {
        tokenCount++;
      }

      assert(tokenCount > 0);
    });
  });

  await test.step("[fixture] www.youtube.com.har.gz", async (test) => {
    await test.step("should stream 131 MB without error", async () => {
      const input = `${FIXTURE_BASE}/www.youtube.com.har.gz`;
      const headers = new Headers({ "Accept": "application/octet-stream" });

      if (GITHUB_TOKEN) {
        headers.set("Authorization", `Bearer ${GITHUB_TOKEN}`);
      }

      const response = await fetch(input, { headers });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch fixture: ${response.statusText}`);
      }

      const decompresser = new DecompressionStream("gzip");
      const decoder = new JSONTextDecoderStream();
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let tokenCount = 0;

      for await (const _ of stream) {
        tokenCount++;
      }

      assert(tokenCount > 0);
    });
  });
});
