import Token from "#src/api/token";
import Value from "#src/api/value";
import { SyntacticError } from "#src/common/errors";
import { JSONTextEncoder } from "#src/index";
import { decodeText, encodeText } from "#src/utils/text";
import { assertEquals, assertThrows } from "#std/assert";

Deno.test("[integration] JSONTextEncoder", async (test) => {
  await test.step("[scenario] writeToken", async (test) => {
    await test.step("should write a null token", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("null"));

      assertEquals(decodeText(encoder.takeBytes()), "null");
    });

    await test.step("should write a boolean token", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromBoolean(true));

      assertEquals(decodeText(encoder.takeBytes()), "true");
    });

    await test.step("should write a number token", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromNumber(42));

      assertEquals(decodeText(encoder.takeBytes()), "42");
    });

    await test.step("should write a string token", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromString("hello"));

      assertEquals(decodeText(encoder.takeBytes()), '"hello"');
    });

    await test.step("should write array tokens producing compact JSON", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("["));
      encoder.writeToken(Token.fromNumber(1));
      encoder.writeToken(Token.fromNumber(2));
      encoder.writeToken(Token.fromText("]"));

      assertEquals(decodeText(encoder.takeBytes()), "[1,2]");
    });

    await test.step("should write object tokens with space after colon", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("{"));
      encoder.writeToken(Token.fromString("a"));
      encoder.writeToken(Token.fromNumber(1));
      encoder.writeToken(Token.fromText("}"));

      assertEquals(decodeText(encoder.takeBytes()), '{"a": 1}');
    });

    await test.step("should throw SyntacticError when a number is written as an object key", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("{"));

      const error = assertThrows(
        () => encoder.writeToken(Token.fromNumber(1)),
        SyntacticError,
      ) as SyntacticError;

      assertEquals(error.offset, 1);
      assertEquals(error.pointer.toString(), "");
    });
  });

  await test.step("[scenario] writeValue", async (test) => {
    await test.step("should write a scalar value", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeValue(new Value(encodeText("42")));

      assertEquals(decodeText(encoder.takeBytes()), "42");
    });

    await test.step("should write a nested array as a single call", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeValue(new Value(encodeText("[1,2]")));

      assertEquals(decodeText(encoder.takeBytes()), "[1,2]");
    });

    await test.step("should write a nested object as a single call", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeValue(new Value(encodeText('{"a":1}')));

      assertEquals(decodeText(encoder.takeBytes()), '{"a":1}');
    });
  });

  await test.step("[scenario] takeBytes", async (test) => {
    await test.step("should return an empty buffer before any writes", () => {
      const encoder = new JSONTextEncoder();

      assertEquals(encoder.takeBytes(), new Uint8Array(0));
    });

    await test.step("should return the written bytes after writing", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromNumber(42));

      assertEquals(encoder.takeBytes(), encodeText("42"));
    });
  });

  await test.step("[scenario] outputOffset", async (test) => {
    await test.step("should return 0 before any writes", () => {
      const encoder = new JSONTextEncoder();

      assertEquals(encoder.outputOffset(), 0);
    });

    await test.step("should advance after each token is written", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("["));

      assertEquals(encoder.outputOffset(), 1);
      encoder.writeToken(Token.fromNumber(1));

      assertEquals(encoder.outputOffset(), 2);
    });
  });

  await test.step("[scenario] stackPointer", async (test) => {
    await test.step("should return empty pointer at root before writing", () => {
      const encoder = new JSONTextEncoder();

      assertEquals(encoder.stackPointer(0).toString(), "");
    });

    await test.step("should return the key pointer inside an object after writing a key", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("{"));
      encoder.writeToken(Token.fromString("key"));

      assertEquals(encoder.stackPointer(0).toString(), "/key");
    });
  });

  await test.step("[scenario] options", async (test) => {
    await test.step("should produce multiline indented output by default", () => {
      const encoder = new JSONTextEncoder();

      encoder.writeToken(Token.fromText("["));
      encoder.writeToken(Token.fromNumber(1));
      encoder.writeToken(Token.fromText("]"));

      assertEquals(decodeText(encoder.takeBytes()), "[\n\t1\n]");
    });

    await test.step("should produce compact output when multiline is false", () => {
      const encoder = new JSONTextEncoder({ multiline: false });

      encoder.writeToken(Token.fromText("["));
      encoder.writeToken(Token.fromNumber(1));
      encoder.writeToken(Token.fromText("]"));

      assertEquals(decodeText(encoder.takeBytes()), "[1]");
    });

    await test.step("should not add space after colon when spaceAfterColon is false", () => {
      const encoder = new JSONTextEncoder({ multiline: false, spaceAfterColon: false });

      encoder.writeToken(Token.fromText("{"));
      encoder.writeToken(Token.fromString("a"));
      encoder.writeToken(Token.fromNumber(1));
      encoder.writeToken(Token.fromText("}"));

      assertEquals(decodeText(encoder.takeBytes()), '{"a":1}');
    });

    await test.step("should canonicalize raw numbers when option is enabled", () => {
      const encoder = new JSONTextEncoder({ multiline: false, canonicalizeRawNumbers: true });

      encoder.writeToken(Token.fromText("1.0e1"));

      assertEquals(decodeText(encoder.takeBytes()), "10");
    });

    await test.step("should escape HTML characters when escapeForHTML is enabled", () => {
      const encoder = new JSONTextEncoder({ multiline: false, escapeForHTML: true });

      encoder.writeToken(Token.fromString("<b>&</b>"));

      assertEquals(decodeText(encoder.takeBytes()), '"\\u003cb\\u003e\\u0026\\u003c/b\\u003e"');
    });

    await test.step("should escape JS line terminators when escapeForJS is enabled", () => {
      const encoder = new JSONTextEncoder({ multiline: false, escapeForJS: true });

      encoder.writeToken(Token.fromString("\u2028\u2029"));

      assertEquals(decodeText(encoder.takeBytes()), '"\\u2028\\u2029"');
    });
  });
});
