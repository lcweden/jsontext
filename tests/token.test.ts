import { KIND } from "#src/common/constants.ts";
import Token from "#src/modules/token.ts";
import { encodeText as e } from "#src/utils/text.ts";
import { assertEquals, assertThrows } from "#std/assert";

Deno.test("[module] token", async (test) => {
  await test.step("[function] constructor", async (test) => {
    await test.step("should throw errors for invalid tokens", () => {
      const cases = [
        { fn: () => new Token(new Uint8Array(0)), ErrorClass: RangeError },
        { fn: () => new Token(new Uint8Array([0x41])), ErrorClass: SyntaxError },
        { fn: () => new Token(e("   ")), ErrorClass: SyntaxError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });
  });

  await test.step("[function] fromText", async (test) => {
    await test.step("should create a token from a raw string", () => {
      const cases = [
        { actual: new Token(e('"true"')).kind, expected: Token.fromText('"true"') },
        { actual: new Token(e("42")).kind, expected: Token.fromText("42") },
        { actual: new Token(e("null")).kind, expected: Token.fromText("null") },
        { actual: new Token(e("{")).kind, expected: Token.fromText("{") },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected.kind);
      }
    });
  });

  await test.step("[function] fromBoolean", async (test) => {
    await test.step("should create a token from a boolean value", () => {
      const cases = [
        { accept: Token.fromBoolean(true), expected: new Token(e("true")) },
        { accept: Token.fromBoolean(false), expected: new Token(e("false")) },
      ];

      for (const { accept, expected } of cases) {
        assertEquals(accept.kind, expected.kind);
      }
    });
  });

  await test.step("[function] fromNumber", async (test) => {
    await test.step("should create a token from a number", () => {
      const cases = [
        { accept: Token.fromNumber(42), expected: new Token(e("42")) },
        { accept: Token.fromNumber(-3.14), expected: new Token(e("-3.14")) },
        { accept: Token.fromNumber(0), expected: new Token(e("0")) },
        { accept: Token.fromNumber(-0), expected: Token.fromNumber(0) },
      ];

      for (const { accept, expected } of cases) {
        assertEquals(accept.kind, expected.kind);
      }
    });

    await test.step("should represent non-finite numbers as strings", () => {
      const cases = [
        { accept: Token.fromNumber(NaN), expected: KIND.STRING },
        { accept: Token.fromNumber(Infinity), expected: KIND.STRING },
        { accept: Token.fromNumber(-Infinity), expected: KIND.STRING },
      ];

      for (const { accept, expected } of cases) {
        assertEquals(accept.kind, expected);
      }
    });
  });

  await test.step("[function] fromString", async (test) => {
    await test.step("should create a token from a string value", () => {
      const cases = [
        { accept: Token.fromString("hello world"), expected: new Token(e('"hello world"')) },
        { accept: Token.fromString(""), expected: Token.fromText('""') },
      ];

      for (const { accept, expected } of cases) {
        assertEquals(accept.kind, expected.kind);
      }
    });
  });

  await test.step("[function] clone", async (test) => {
    await test.step("should create a clone of the token", () => {
      const a = new Token(e('"clone me"'));
      const b = a.clone();

      assertEquals(a.kind, b.kind);
      assertEquals(a.bytes, b.bytes);
    });
  });

  await test.step("[function] isScalar", async (test) => {
    await test.step("should return true for scalar tokens", () => {
      const cases = [
        { actual: new Token(e('"string"')), expected: true },
        { actual: new Token(e("123")), expected: true },
        { actual: new Token(e("true")), expected: true },
        { actual: new Token(e("false")), expected: true },
        { actual: new Token(e("null")), expected: true },
      ];

      for (const { actual, expected } of cases) assertEquals(actual.isScalar(), expected);
    });
  });

  await test.step("[function] isStructural", async (test) => {
    await test.step("should return true for structural tokens", () => {
      const cases = [
        { actual: new Token(e("{")), expected: true },
        { actual: new Token(e("}")), expected: true },
        { actual: new Token(e("[")), expected: true },
        { actual: new Token(e("]")), expected: true },
      ];

      for (const { actual, expected } of cases) assertEquals(actual.isStructural(), expected);
    });
  });

  await test.step("[function] asString", async (test) => {
    await test.step("should convert a string token to a string", () => {
      const cases = [
        { actual: new Token(e('"hello world"')).asString(), expected: "hello world" },
        { actual: new Token(e('""')).asString(), expected: "" },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should throw an error for non-string tokens", () => {
      const cases = [
        { fn: () => new Token(e("42")).asString(), ErrorClass: TypeError },
        { fn: () => new Token(e("true")).asString(), ErrorClass: TypeError },
        { fn: () => new Token(e("null")).asString(), ErrorClass: TypeError },
        { fn: () => new Token(e("{")).asString(), ErrorClass: TypeError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });
  });

  await test.step("[function] asNumber", async (test) => {
    await test.step("should convert a number token to a number", () => {
      const token = new Token(e("42"));
      const num = token.asNumber();

      assertEquals(num, 42);
    });

    await test.step("should throw an error for non-number tokens", () => {
      const cases = [
        { fn: () => new Token(e('"not a number"')).asNumber(), ErrorClass: TypeError },
        { fn: () => new Token(e("true")).asNumber(), ErrorClass: TypeError },
        { fn: () => new Token(e("null")).asNumber(), ErrorClass: TypeError },
        { fn: () => new Token(e("{")).asNumber(), ErrorClass: TypeError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });
  });

  await test.step("[function] asBoolean", async (test) => {
    await test.step("should convert a boolean token to a boolean", () => {
      const cases = [
        { actual: new Token(e("true")).asBoolean(), expected: true },
        { actual: new Token(e("false")).asBoolean(), expected: false },
      ];

      for (const { actual, expected } of cases) {
        assertEquals(actual, expected);
      }
    });

    await test.step("should throw an error for non-boolean tokens", () => {
      const cases = [
        { fn: () => new Token(e('"not a boolean"')).asBoolean(), ErrorClass: TypeError },
        { fn: () => new Token(e("42")).asBoolean(), ErrorClass: TypeError },
        { fn: () => new Token(e("null")).asBoolean(), ErrorClass: TypeError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });
  });

  await test.step("[function] asNull", async (test) => {
    await test.step("should convert a null token to null", () => {
      const token = new Token(e("null"));
      const value = token.asNull();

      assertEquals(value, null);
    });

    await test.step("should throw an error for non-null tokens", () => {
      const cases = [
        { fn: () => new Token(e('"not null"')).asNull(), ErrorClass: TypeError },
        { fn: () => new Token(e("42")).asNull(), ErrorClass: TypeError },
        { fn: () => new Token(e("true")).asNull(), ErrorClass: TypeError },
        { fn: () => new Token(e("{")).asNull(), ErrorClass: TypeError },
      ];

      for (const { fn, ErrorClass } of cases) {
        assertThrows(fn, ErrorClass);
      }
    });
  });
});
