import { KIND } from "#src/common/constants";
import { JSONTextSelectorStream } from "#src/index";
import { assert, assertEquals } from "#std/assert";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const FIXTURE_BASE = "https://github.com/lcweden/jsontext/releases/download/fixtures";

Deno.test("[e2e] round-trip", async (test) => {
  await test.step("[fixture] json_bus.json.gz", async (test) => {
    await test.step("should emit object values from $.features[*]", async () => {
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
      const decoder = new JSONTextSelectorStream("$.features[*]");
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let count = 0;

      for await (const value of stream) {
        assertEquals(value.kind, KIND.OBJECT_BEGIN);
        count++;
      }

      assert(count > 0);
    });

    await test.step("should emit coordinate arrays from $.features[*].geometry.coordinates", async () => {
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
      const decoder = new JSONTextSelectorStream("$.features[*].geometry.coordinates");
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let count = 0;

      for await (const value of stream) {
        if (count >= 100) break;

        const coordinates = value.json() as unknown[];

        assert(Array.isArray(coordinates) && coordinates.length === 2);
        count++;
      }

      assert(count > 0);
    });
  });

  await test.step("[fixture] www.youtube.com.har.gz", async (test) => {
    await test.step("should emit string values from $.log.entries[*].request.url", async () => {
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
      const decoder = new JSONTextSelectorStream("$.log.entries[*].request.url");
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let count = 0;

      for await (const value of stream) {
        assertEquals(value.kind, KIND.STRING);
        count++;
      }

      assert(count > 0);
    });

    await test.step("should emit string values from $..url", async () => {
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
      const decoder = new JSONTextSelectorStream("$..url");
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let count = 0;

      for await (const value of stream) {
        assertEquals(value.kind, KIND.STRING);
        count++;
      }

      assert(count > 0);
    });

    await test.step("should emit no values from $.log.nonexistent[*]", async () => {
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
      const decoder = new JSONTextSelectorStream("$.log.nonexistent[*]");
      const stream = response.body.pipeThrough(decompresser).pipeThrough(decoder);

      let count = 0;

      for await (const _ of stream) {
        count++;
      }

      assertEquals(count, 0);
    });
  });
});
