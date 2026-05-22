import Path from "#src/modules/path.ts";
import { encodeText } from "#src/utils/text.ts";
import { assert, assertThrows } from "#std/assert";

Deno.test("[module] path", async (test) => {
  await test.step("[function] constructor", async (test) => {
    await test.step("should create instances of Path", () => {
      const cases = [
        { expr: new Path(encodeText("$")) },
        { expr: new Path(encodeText("$.child")) },
        { expr: new Path(encodeText("$..descendant")) },
        { expr: new Path(encodeText("$.name")) },
        { expr: new Path(encodeText("$.*")) },
        { expr: new Path(encodeText("$[0]")) },
        { expr: new Path(encodeText("$[0:1]")) },
        { expr: new Path(encodeText("$['child']")) },
        { expr: new Path(encodeText('$["child"]')) },
        { expr: new Path(encodeText("$[*]")) },
        { expr: new Path(encodeText("$..*")) },
        { expr: new Path(encodeText("$..[*]")) },
        { expr: new Path(encodeText("$[10]")) },
        { expr: new Path(encodeText("$[1:]")) },
        { expr: new Path(encodeText("$[:5]")) },
        { expr: new Path(encodeText("$[:]")) },
        { expr: new Path(encodeText("$.store.branches[*].categories.electronics[0:2]")) },
        { expr: new Path(encodeText("$.store.branches[1].categories.*[0]")) },
        { expr: new Path(encodeText("$..branches[*].categories.electronics[1:3].tags[*]")) },
      ];

      for (const { expr } of cases) {
        assert(expr);
      }
    });

    await test.step("should throw errors for unaccepted paths", () => {
      const cases = [
        { fn: () => new Path(encodeText("$[-1]")) },
        { fn: () => new Path(encodeText("$[-10]")) },
        { fn: () => new Path(encodeText("$[-2:]")) },
        { fn: () => new Path(encodeText("$[:-1]")) },
        { fn: () => new Path(encodeText("$[-2:-1]")) },
        { fn: () => new Path(encodeText("$[?(@.price > 10)]")) },
        { fn: () => new Path(encodeText("$.['name','age']")) },
        { fn: () => new Path(encodeText("$[0,1]")) },
        { fn: () => new Path(encodeText("")) },
        { fn: () => new Path(encodeText("child")) },
        { fn: () => new Path(encodeText("$[")) },
        { fn: () => new Path(encodeText("$.[")) },
        { fn: () => new Path(encodeText("$.")) },
        { fn: () => new Path(encodeText("$...child")) },
      ];

      for (const { fn } of cases) {
        assertThrows(fn);
      }
    });
  });
});
