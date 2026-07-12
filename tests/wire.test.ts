import { encodeText as e } from "#src/utils/text";
import {
  compareUTF16,
  consumeFalse,
  consumeNull,
  consumeNumber,
  consumeSimpleNumber,
  consumeSimpleString,
  consumeString,
  consumeStringResumable,
  consumeTrue,
  consumeWhitespace,
} from "#src/utils/wire";
import { assertEquals } from "#std/assert";

Deno.test("[utils] wire", async (test) => {
  await test.step("[function] compareUTF16", async (test) => {
    await test.step("return a correct comparison result", () => {
      const cases = [
        { actual: compareUTF16("abc", "abd"), expected: -1 },
        { actual: compareUTF16("abd", "abc"), expected: 1 },
        { actual: compareUTF16("", ""), expected: 0 },
        { actual: compareUTF16("abc", "abc"), expected: 0 },
        { actual: compareUTF16("", "a"), expected: -1 },
        { actual: compareUTF16("ab", "abc"), expected: -1 },
        { actual: compareUTF16("\u0041", "\u0042"), expected: -1 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeWhitespace", async (test) => {
    await test.step("consume leading whitespace", () => {
      const cases = [
        { actual: consumeWhitespace(e("\t\n\r Hello"), 0), expected: 4 },
        { actual: consumeWhitespace(e("   World"), 0), expected: 3 },
        { actual: consumeWhitespace(e("NoLeadingWhitespace"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume whitespace at non-zero position", () => {
      const cases = [
        { actual: consumeWhitespace(e("Hello   World"), 5), expected: 8 },
        { actual: consumeWhitespace(e("ab\t\ncd"), 2), expected: 4 },
        { actual: consumeWhitespace(e("no spaces"), 3), expected: 3 },
        { actual: consumeWhitespace(e("end   "), 3), expected: 6 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("stop consuming at the first non-whitespace character", () => {
      const cases = [
        { actual: consumeWhitespace(e("   Hello World"), 0), expected: 3 },
        { actual: consumeWhitespace(e("\t\n\r Hello"), 0), expected: 4 },
        { actual: consumeWhitespace(e("NoLeadingWhitespace"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("handle edge positions", () => {
      const bytes = e("abc");

      const cases = [
        { actual: consumeWhitespace(new Uint8Array(0), 0), expected: 0 },
        { actual: consumeWhitespace(bytes, bytes.length), expected: bytes.length },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeNull", async (test) => {
    await test.step("consume the 'null' literal", () => {
      const cases = [
        { actual: consumeNull(e("null"), 0), expected: 4 },
        { actual: consumeNull(e("nullValue"), 0), expected: 4 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 when the 'null' literal is not found", () => {
      const cases = [
        { actual: consumeNull(e("notNull"), 0), expected: 0 },
        { actual: consumeNull(e(""), 0), expected: 0 },
        { actual: consumeNull(e("nul"), 0), expected: 0 },
        { actual: consumeNull(e("nulx"), 0), expected: 0 },
        { actual: consumeNull(e("Null"), 0), expected: 0 },
        { actual: consumeNull(e("NULL"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeNull(e("  null"), 2), expected: 4 },
        { actual: consumeNull(e("xnull"), 1), expected: 4 },
        { actual: consumeNull(e("  null"), 3), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeTrue", async (test) => {
    await test.step("consume the 'true' literal", () => {
      const cases = [
        { actual: consumeTrue(e("true"), 0), expected: 4 },
        { actual: consumeTrue(e("trueValue"), 0), expected: 4 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 when the 'true' literal is not found", () => {
      const cases = [
        { actual: consumeTrue(e("false"), 0), expected: 0 },
        { actual: consumeTrue(e(""), 0), expected: 0 },
        { actual: consumeTrue(e("tru"), 0), expected: 0 },
        { actual: consumeTrue(e("trux"), 0), expected: 0 },
        { actual: consumeTrue(e("True"), 0), expected: 0 },
        { actual: consumeTrue(e("TRUE"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeTrue(e("  true"), 2), expected: 4 },
        { actual: consumeTrue(e("xtrue"), 1), expected: 4 },
        { actual: consumeTrue(e("  true"), 3), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeFalse", async (test) => {
    await test.step("consume the 'false' literal", () => {
      const cases = [
        { actual: consumeFalse(e("false"), 0), expected: 5 },
        { actual: consumeFalse(e("falseValue"), 0), expected: 5 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 when the 'false' literal is not found", () => {
      const cases = [
        { actual: consumeFalse(e("true"), 0), expected: 0 },
        { actual: consumeFalse(e(""), 0), expected: 0 },
        { actual: consumeFalse(e("fals"), 0), expected: 0 },
        { actual: consumeFalse(e("falsx"), 0), expected: 0 },
        { actual: consumeFalse(e("False"), 0), expected: 0 },
        { actual: consumeFalse(e("FALSE"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeFalse(e("  false"), 2), expected: 5 },
        { actual: consumeFalse(e("xfalse"), 1), expected: 5 },
        { actual: consumeFalse(e("  false"), 3), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeString", async (test) => {
    await test.step("consume a valid string literal", () => {
      const cases = [
        { actual: consumeString(e('""'), 0), expected: 2 },
        { actual: consumeString(e('"hello"'), 0), expected: 7 },
        { actual: consumeString(e('"hello world"'), 0), expected: 13 },
        { actual: consumeString(e('"\\"" '), 0), expected: 4 },
        { actual: consumeString(e('"\\\\"'), 0), expected: 4 },
        { actual: consumeString(e('"say \\"hi\\""'), 0), expected: 12 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for invalid string literals", () => {
      const cases = [
        { actual: consumeString(e("hello"), 0), expected: 0 },
        { actual: consumeString(e('"hello'), 0), expected: 0 },
        { actual: consumeString(e('"hel\x01lo"'), 0), expected: 0 },
        { actual: consumeString(e('"hel\x1Flo"'), 0), expected: 0 },
        { actual: consumeString(new Uint8Array(0), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("validate UTF-8 by default", () => {
      const cases = [
        { actual: consumeString(new Uint8Array([0x22, 0x80, 0x22]), 0), expected: 0 },
        { actual: consumeString(new Uint8Array([0x22, 0x80, 0x22]), 0, false), expected: 3 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeString(e('  "hi"'), 2), expected: 4 },
        { actual: consumeString(e('x"hello"'), 1), expected: 7 },
        { actual: consumeString(e('  "hi"'), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeStringResumable", async (test) => {
    await test.step("resume scanning a string across chunks", () => {
      const full = e('"hello world"');
      const partial = full.subarray(0, full.length - 1);

      const first = consumeStringResumable(partial, 0, 0);

      assertEquals(first, {
        consumed: partial.length,
        completed: false,
      });

      const second = consumeStringResumable(full, 0, first.consumed);

      assertEquals(second, {
        consumed: full.length,
        completed: true,
      });
    });

    await test.step("resume correctly when a chunk ends with a backslash", () => {
      const full = e('"\\""');
      const partial = full.subarray(0, 2);

      const first = consumeStringResumable(partial, 0, 0);

      assertEquals(first, {
        consumed: 1,
        completed: false,
      });

      const second = consumeStringResumable(full, 0, first.consumed);

      assertEquals(second, {
        consumed: full.length,
        completed: true,
      });
    });

    await test.step("defer final UTF-8 validation until the closing quote is present", () => {
      const full = new Uint8Array([0x22, 0x80, 0x22]);
      const partial = full.subarray(0, 2);

      const first = consumeStringResumable(partial, 0, 0);

      assertEquals(first, {
        consumed: partial.length,
        completed: false,
      });

      const second = consumeStringResumable(full, 0, first.consumed);

      assertEquals(second, {
        consumed: 0,
        completed: false,
      });
    });
  });

  await test.step("[function] consumeNumber", async (test) => {
    await test.step("consume a valid number literal", () => {
      const cases = [
        { actual: consumeNumber(e("0"), 0), expected: 1 },
        { actual: consumeNumber(e("123"), 0), expected: 3 },
        { actual: consumeNumber(e("-42"), 0), expected: 3 },
        { actual: consumeNumber(e("-0"), 0), expected: 2 },
        { actual: consumeNumber(e("3.14"), 0), expected: 4 },
        { actual: consumeNumber(e("1e10"), 0), expected: 4 },
        { actual: consumeNumber(e("1E10"), 0), expected: 4 },
        { actual: consumeNumber(e("1e+5"), 0), expected: 4 },
        { actual: consumeNumber(e("1e-5"), 0), expected: 4 },
        { actual: consumeNumber(e("-1.5e-3"), 0), expected: 7 },
        { actual: consumeNumber(e("123abc"), 0), expected: 3 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for invalid number literals", () => {
      const cases = [
        { actual: consumeNumber(e(""), 0), expected: 0 },
        { actual: consumeNumber(e("-"), 0), expected: 0 },
        { actual: consumeNumber(e(".5"), 0), expected: 0 },
        { actual: consumeNumber(e("01"), 0), expected: 0 },
        { actual: consumeNumber(e("1."), 0), expected: 0 },
        { actual: consumeNumber(e("1e"), 0), expected: 0 },
        { actual: consumeNumber(e("1e+"), 0), expected: 0 },
        { actual: consumeNumber(e("abc"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeNumber(e("  123"), 2), expected: 3 },
        { actual: consumeNumber(e("x-1.5"), 1), expected: 4 },
        { actual: consumeNumber(e("  123"), 4), expected: 1 },
        { actual: consumeNumber(e("  123"), 5), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeSimpleNumber", async (test) => {
    await test.step("consume a valid simple number", () => {
      const cases = [
        { actual: consumeSimpleNumber(e("0"), 0), expected: 1 },
        { actual: consumeSimpleNumber(e("123"), 0), expected: 3 },
        { actual: consumeSimpleNumber(e("9999"), 0), expected: 4 },
        { actual: consumeSimpleNumber(e("123abc"), 0), expected: 3 },
        { actual: consumeSimpleNumber(e("07"), 0), expected: 1 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for numbers with decimal or exponent parts", () => {
      const cases = [
        { actual: consumeSimpleNumber(e("1.5"), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("1e5"), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("1E5"), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("0.5"), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("0e1"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for invalid input", () => {
      const cases = [
        { actual: consumeSimpleNumber(e(""), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("-1"), 0), expected: 0 },
        { actual: consumeSimpleNumber(e("abc"), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeSimpleNumber(e("  42"), 2), expected: 2 },
        { actual: consumeSimpleNumber(e("x0"), 1), expected: 1 },
        { actual: consumeSimpleNumber(e("  42"), 4), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });

  await test.step("[function] consumeSimpleString", async (test) => {
    await test.step("consume a valid simple string", () => {
      const cases = [
        { actual: consumeSimpleString(e('""'), 0), expected: 2 },
        { actual: consumeSimpleString(e('"hello"'), 0), expected: 7 },
        { actual: consumeSimpleString(e('"hello world"'), 0), expected: 13 },
        { actual: consumeSimpleString(e('"abc" rest'), 0), expected: 5 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for disallowed characters", () => {
      const cases = [
        { actual: consumeSimpleString(e('"hel\\lo"'), 0), expected: 0 },
        { actual: consumeSimpleString(e('"hel\x01lo"'), 0), expected: 0 },
        { actual: consumeSimpleString(e('"hel\x1Flo"'), 0), expected: 0 },
        { actual: consumeSimpleString(new Uint8Array([0x22, 0x7F, 0x22]), 0), expected: 0 },
        { actual: consumeSimpleString(new Uint8Array([0x22, 0x80, 0x22]), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("return 0 for invalid string structure", () => {
      const cases = [
        { actual: consumeSimpleString(e("hello"), 0), expected: 0 },
        { actual: consumeSimpleString(e('"hello'), 0), expected: 0 },
        { actual: consumeSimpleString(new Uint8Array(0), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("consume at non-zero position", () => {
      const cases = [
        { actual: consumeSimpleString(e('  "hi"'), 2), expected: 4 },
        { actual: consumeSimpleString(e('x"abc"'), 1), expected: 5 },
        { actual: consumeSimpleString(e('  "hi"'), 0), expected: 0 },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });
  });
});
