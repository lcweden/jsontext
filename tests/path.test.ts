import Path from "#src/modules/path";
import Pointer from "#src/modules/pointer";
import { encodeText } from "#src/utils/text";
import { assert, assertFalse, assertThrows } from "#std/assert";

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

  await test.step("[function] match", async (test) => {
    await test.step("should return true for matching paths", () => {
      const cases = [
        new Path(encodeText("$")).match(new Pointer([]).tokens),
        new Path(encodeText("$.foo")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$.*")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$.*")).match(new Pointer(["0"]).tokens),
        new Path(encodeText("$[2]")).match(new Pointer(["2"]).tokens),
        new Path(encodeText("$[1:3]")).match(new Pointer(["1"]).tokens),
        new Path(encodeText("$[1:3]")).match(new Pointer(["2"]).tokens),
        new Path(encodeText("$[:]")).match(new Pointer(["0"]).tokens),
        new Path(encodeText("$[:]")).match(new Pointer(["99"]).tokens),
        new Path(encodeText("$['child']")).match(new Pointer(["child"]).tokens),
        new Path(encodeText("$.foo.bar")).match(new Pointer(["foo", "bar"]).tokens),
        new Path(encodeText("$..foo")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$..foo")).match(new Pointer(["a", "foo"]).tokens),
        new Path(encodeText("$..foo")).match(new Pointer(["a", "b", "foo"]).tokens),
        new Path(encodeText("$..*")).match(new Pointer(["x"]).tokens),
        new Path(encodeText("$..*")).match(new Pointer(["x", "y"]).tokens),
        new Path(encodeText("$.a.b[*]")).match(new Pointer(["a", "b", "0"]).tokens),
        new Path(encodeText("$.a.b[*]")).match(new Pointer(["a", "b", "5"]).tokens),
      ];

      for (const expr of cases) {
        assert(expr);
      }
    });

    await test.step("should return false for non-matching paths", () => {
      const cases = [
        new Path(encodeText("$")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$.foo")).match(new Pointer(["bar"]).tokens),
        new Path(encodeText("$.foo")).match(new Pointer([]).tokens),
        new Path(encodeText("$.foo")).match(new Pointer(["foo", "bar"]).tokens),
        new Path(encodeText("$.*")).match(new Pointer([]).tokens),
        new Path(encodeText("$.*")).match(new Pointer(["foo", "bar"]).tokens),
        new Path(encodeText("$[2]")).match(new Pointer(["1"]).tokens),
        new Path(encodeText("$[2]")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$[1:3]")).match(new Pointer(["0"]).tokens),
        new Path(encodeText("$[1:3]")).match(new Pointer(["3"]).tokens),
        new Path(encodeText("$[:]")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$.foo.bar")).match(new Pointer(["foo"]).tokens),
        new Path(encodeText("$.foo.bar")).match(new Pointer(["foo", "baz"]).tokens),
        new Path(encodeText("$..foo")).match(new Pointer(["bar"]).tokens),
        new Path(encodeText("$..foo")).match(new Pointer(["foo", "bar"]).tokens),
        new Path(encodeText("$.a.b[*]")).match(new Pointer(["a", "b"]).tokens),
        new Path(encodeText("$.a.b[*]")).match(new Pointer(["a", "b", "0", "name"]).tokens),
      ];

      for (const expr of cases) {
        assertFalse(expr);
      }
    });
  });
});
