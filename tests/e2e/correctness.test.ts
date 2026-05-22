import { KIND } from "#src/common/constants.ts";
import { JSONTextDecoderStream, JSONTextLineStream, Token } from "#src/index.ts";
import { assert, assertEquals } from "#std/assert";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const FIXTURE_BASE = "https://github.com/lcweden/jsontext/releases/download/fixtures";

Deno.test("[e2e] correctness", async (test) => {
  await test.step("[fixture] edge_cases.json.gz", async (test) => {
    await test.step("should have balanced structural tokens", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
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

      let objectBegin = 0, objectEnd = 0, arrayBegin = 0, arrayEnd = 0;

      for await (const token of stream) {
        if (token.kind === KIND.OBJECT_BEGIN) objectBegin++;
        else if (token.kind === KIND.OBJECT_END) objectEnd++;
        else if (token.kind === KIND.ARRAY_BEGIN) arrayBegin++;
        else if (token.kind === KIND.ARRAY_END) arrayEnd++;
      }

      assertEquals(objectBegin, objectEnd);
      assertEquals(arrayBegin, arrayEnd);
    });

    await test.step("should handle 60-level deep nesting without error", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
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

      let currentDepth = 0, maxDepth = 0;

      for await (const token of stream) {
        if (token.kind === KIND.OBJECT_BEGIN || token.kind === KIND.ARRAY_BEGIN) {
          maxDepth = Math.max(maxDepth, ++currentDepth);
        } else if (token.kind === KIND.OBJECT_END || token.kind === KIND.ARRAY_END) {
          currentDepth--;
        }
      }

      assert(maxDepth >= 60);
      assert(maxDepth < 10000);
    });

    await test.step("should round-trip string tokens losslessly via asString()", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
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

      for await (const token of stream) {
        if (token.kind !== KIND.STRING) continue;

        const str = token.asString();

        assertEquals(Token.fromString(str).asString(), str);
      }
    });

    await test.step("should decode all number tokens without throwing", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
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

      for await (const token of stream) {
        if (token.kind !== KIND.NUMBER) continue;

        token.asNumber();
      }
    });

    await test.step("should contain at least one 1200-char string", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
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

      let found = false;

      for await (const token of stream) {
        if (token.kind === KIND.STRING && token.asString().length === 1200) {
          found = true;
        }
      }

      assert(found);
    });

    await test.step("should canonicalize idempotently", async () => {
      const input = `${FIXTURE_BASE}/edge_cases.json.gz`;
      const headers = new Headers({ "Accept": "application/octet-stream" });

      if (GITHUB_TOKEN) {
        headers.set("Authorization", `Bearer ${GITHUB_TOKEN}`);
      }

      const response = await fetch(input, { headers });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch fixture: ${response.statusText}`);
      }

      const decompresser = new DecompressionStream("gzip");
      const decoder = new JSONTextLineStream();
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      for await (const value of stream) {
        const once = value.canonicalize();
        const twice = once.canonicalize();

        assertEquals(once.text(), twice.text());
      }
    });
  });
});
