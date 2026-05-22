import { KIND } from "#src/common/constants.ts";
import Value from "#src/modules/value.ts";
import { encodeText as e } from "#src/utils/text.ts";
import { assertEquals, assertFalse, assertThrows } from "#std/assert";

Deno.test("[module] value", async (test) => {
  await test.step("[function] constructor", async (test) => {
    await test.step("should return the correct string representation", () => {
      const cases = [
        { actual: new Value(e('"hello"')).text(), expected: '"hello"' },
        { actual: new Value(e("true")).text(), expected: "true" },
        { actual: new Value(e("false")).text(), expected: "false" },
        { actual: new Value(e("null")).text(), expected: "null" },
        { actual: new Value(e("{}")).text(), expected: "{}" },
        { actual: new Value(e("[]")).text(), expected: "[]" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should return the correct kind", () => {
      const cases = [
        { actual: new Value(e('"hello"')).kind, expected: KIND.STRING },
        { actual: new Value(e("true")).kind, expected: KIND.TRUE },
        { actual: new Value(e("false")).kind, expected: KIND.FALSE },
        { actual: new Value(e("null")).kind, expected: KIND.NULL },
        { actual: new Value(e("{}")).kind, expected: KIND.OBJECT_BEGIN },
        { actual: new Value(e("[]")).kind, expected: KIND.ARRAY_BEGIN },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should throw for unexpected input", () => {
      const cases = [
        { fn: () => new Value(new Uint8Array(0)), ErrorClass: RangeError },
        { fn: () => new Value(e("   ")), ErrorClass: SyntaxError },
        { fn: () => new Value(new Uint8Array([0x41])), ErrorClass: SyntaxError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });

    await test.step("should recognize with leading whitespace", () => {
      const cases = [
        { actual: new Value(e("   42")).kind, expected: KIND.NUMBER },
        { actual: new Value(e("\ttrue")).kind, expected: KIND.TRUE },
        { actual: new Value(e("\n42")).kind, expected: KIND.NUMBER },
        { actual: new Value(e("  {")).kind, expected: KIND.OBJECT_BEGIN },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] canonicalize", async (test) => {
    await test.step("should sort object keys lexicographically", () => {
      const cases = [
        {
          actual: new Value(e('{"b":1,"a":2}')).canonicalize().text(),
          expected: '{"a":2,"b":1}',
        },
        {
          actual: new Value(e('{"a":1,"b":2}')).canonicalize().text(),
          expected: '{"a":1,"b":2}',
        },
        {
          actual: new Value(e('{"z":3,"y":2,"x":1}')).canonicalize().text(),
          expected: '{"x":1,"y":2,"z":3}',
        },
        {
          actual: new Value(e('{"b":{"z":1,"a":2},"a":0}')).canonicalize().text(),
          expected: '{"a":0,"b":{"a":2,"z":1}}',
        },
        {
          actual: new Value(e("[3,1,2,3,2,1]")).canonicalize().text(),
          expected: "[3,1,2,3,2,1]",
        },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should normalize number representation", () => {
      const cases = [
        { actual: new Value(e("1.0")).canonicalize().text(), expected: "1" },
        { actual: new Value(e("0.000")).canonicalize().text(), expected: "0" },
        { actual: new Value(e("-0.00")).canonicalize().text(), expected: "0" },
        { actual: new Value(e("3.14000")).canonicalize().text(), expected: "3.14" },
        { actual: new Value(e("1e+0")).canonicalize().text(), expected: "1" },
        { actual: new Value(e("1e-0")).canonicalize().text(), expected: "1" },
        { actual: new Value(e("1e+1")).canonicalize().text(), expected: "10" },
        { actual: new Value(e("1e-1")).canonicalize().text(), expected: "0.1" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should handle empty objects and arrays", () => {
      const cases = [
        { actual: new Value(e("{}")).canonicalize().text(), expected: "{}" },
        { actual: new Value(e("[]")).canonicalize().text(), expected: "[]" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should return scalar values unchanged", () => {
      const cases = [
        { actual: new Value(e('"a"')).canonicalize().text(), expected: '"a"' },
        { actual: new Value(e("true")).canonicalize().text(), expected: "true" },
        { actual: new Value(e("false")).canonicalize().text(), expected: "false" },
        { actual: new Value(e("null")).canonicalize().text(), expected: "null" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] clone", async (test) => {
    await test.step("should produce a value with the same kind and raw bytes", () => {
      const a = new Value(e('"clone me"'));
      const b = a.clone();

      assertEquals(a.kind, b.kind);
      assertEquals(a.bytes, b.bytes);
    });

    await test.step("should produce an independent copy", () => {
      const a = new Value(e('"clone me"'));
      const b = a.clone();

      b.bytes[0] = 0x00;

      assertEquals(a.bytes[0], 0x22);
    });
  });

  await test.step("[function] isValid", async (test) => {
    await test.step("should return true for well-formed JSON values", () => {
      const cases = [
        { actual: new Value(e('"hello world"')).isValid(), expected: true },
        { actual: new Value(e("42")).isValid(), expected: true },
        { actual: new Value(e("-3.14")).isValid(), expected: true },
        { actual: new Value(e("true")).isValid(), expected: true },
        { actual: new Value(e("false")).isValid(), expected: true },
        { actual: new Value(e("null")).isValid(), expected: true },
        { actual: new Value(e("{}")).isValid(), expected: true },
        { actual: new Value(e("[]")).isValid(), expected: true },
        { actual: new Value(e('{"a":1,"b":2}')).isValid(), expected: true },
        { actual: new Value(e("[1,2,3]")).isValid(), expected: true },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should return false for unexpected structures", () => {
      const cases = [
        { expr: new Value(e("{")).isValid() },
        { expr: new Value(e("[")).isValid() },
        { expr: new Value(e('{"a":1')).isValid() },
        { expr: new Value(e("42 extra")).isValid() },
      ];

      for (const { expr } of cases) {
        assertFalse(expr);
      }
    });
  });

  await test.step("[function] text", async (test) => {
    await test.step("should return the raw bytes decoded as a UTF-8 string", () => {
      const cases = [
        { actual: new Value(e('"hello"')).text(), expected: '"hello"' },
        { actual: new Value(e("42")).text(), expected: "42" },
        { actual: new Value(e("true")).text(), expected: "true" },
        { actual: new Value(e("false")).text(), expected: "false" },
        { actual: new Value(e("null")).text(), expected: "null" },
        { actual: new Value(e('{"a":1}')).text(), expected: '{"a":1}' },
        { actual: new Value(e("[1,2]")).text(), expected: "[1,2]" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });
});
