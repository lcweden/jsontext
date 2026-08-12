import { KIND } from "#src/common/constants";
import { SyntacticError } from "#src/common/errors";
import { JSONTextDecoder } from "#src/index";
import { encodeText } from "#src/utils/text";
import { assertEquals, assertThrows } from "#std/assert";

Deno.test("[integration] JSONTextDecoder", async (test) => {
  await test.step("[scenario] readToken", async (test) => {
    await test.step("should read null", () => {
      const json = JSON.stringify(null);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.NULL);
    });

    await test.step("should read true", () => {
      const json = JSON.stringify(true);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.TRUE);
      assertEquals(token?.asBoolean(), true);
    });

    await test.step("should read false", () => {
      const json = JSON.stringify(false);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.FALSE);
      assertEquals(token?.asBoolean(), false);
    });

    await test.step("should read a number", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.NUMBER);
      assertEquals(token?.asNumber(), 42);
    });

    await test.step("should read a string", () => {
      const json = JSON.stringify("hello");
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.STRING);
      assertEquals(token?.asString(), "hello");
    });

    await test.step("should read array tokens in order", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      assertEquals(decoder.readToken()?.kind, KIND.ARRAY_BEGIN);
      assertEquals(decoder.readToken()?.kind, KIND.NUMBER);
      assertEquals(decoder.readToken()?.kind, KIND.NUMBER);
      assertEquals(decoder.readToken()?.kind, KIND.ARRAY_END);
      assertEquals(decoder.readToken(), undefined);
    });

    await test.step("should read object tokens in order", () => {
      const json = JSON.stringify({ a: 1 });
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_BEGIN);
      assertEquals(decoder.readToken()?.asString(), "a");
      assertEquals(decoder.readToken()?.asNumber(), 1);
      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_END);
      assertEquals(decoder.readToken(), undefined);
    });
  });

  await test.step("[scenario] readValue", async (test) => {
    await test.step("should read a scalar value", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const value = decoder.readValue();

      assertEquals(value?.kind, KIND.NUMBER);
      assertEquals(value?.text(), "42");
    });

    await test.step("should read a nested array as one value", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const value = decoder.readValue();

      assertEquals(value?.kind, KIND.ARRAY_BEGIN);
      assertEquals(value?.text(), "[1,2]");
    });

    await test.step("should read a nested object as one value", () => {
      const json = JSON.stringify({ a: 1 });
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const value = decoder.readValue();

      assertEquals(value?.kind, KIND.OBJECT_BEGIN);
      assertEquals(value?.text(), '{"a":1}');
    });

    await test.step("should read elements inside an outer array one at a time", () => {
      const json = JSON.stringify([1, "two", [3]]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      assertEquals(decoder.readValue()?.text(), "1");
      assertEquals(decoder.readValue()?.text(), '"two"');
      assertEquals(decoder.readValue()?.kind, KIND.ARRAY_BEGIN);

      decoder.readToken();
    });

    await test.step("should return undefined when input is incomplete", () => {
      const decoder = new JSONTextDecoder();
      const text = '{"a"';
      const encoded = encodeText(text);

      decoder.push(encoded);

      assertEquals(decoder.readValue(), undefined);
    });
  });

  await test.step("[scenario] peekKind", async (test) => {
    await test.step("should not advance the read position", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      assertEquals(decoder.peekKind(), KIND.NUMBER);
      assertEquals(decoder.peekKind(), KIND.NUMBER);
      assertEquals(decoder.readToken()?.asNumber(), 42);
    });

    await test.step("should return undefined when input is incomplete", () => {
      const decoder = new JSONTextDecoder();

      assertEquals(decoder.peekKind(), undefined);
    });
  });

  await test.step("[scenario] skipValue", async (test) => {
    await test.step("should skip a scalar and allow reading the next value", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();
      decoder.skipValue();

      assertEquals(decoder.readValue()?.text(), "2");
    });

    await test.step("should skip a nested structure and allow reading the next value", () => {
      const json = JSON.stringify([[1, 2], 3]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      decoder.skipValue();
      assertEquals(decoder.readValue()?.text(), "3");
    });
  });

  await test.step("[scenario] streaming", async (test) => {
    await test.step("should parse correctly when fed one byte at a time", () => {
      const json = JSON.stringify("hello");
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder();

      for (let i = 0; i < encoded.length - 1; i++) {
        decoder.push(encoded.subarray(i, i + 1));
        assertEquals(decoder.readToken(), undefined);
      }

      decoder.push(encoded.subarray(encoded.length - 1));
      decoder.end();

      assertEquals(decoder.readToken()?.asString(), "hello");
    });

    await test.step("should resume correctly after incomplete chunks", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder();

      decoder.push(encoded.subarray(0, 2));
      decoder.readToken();

      assertEquals(decoder.readValue(), undefined);

      decoder.push(encoded.subarray(2));
      decoder.end();

      assertEquals(decoder.readValue()?.text(), "1");
      assertEquals(decoder.readValue()?.text(), "2");
    });

    await test.step("should read an object string value split across many chunks", () => {
      const value = "a".repeat(64 * 1024);
      const decoder = new JSONTextDecoder();

      decoder.push(encodeText(`{"key":"${value.slice(0, 1024)}`));

      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_BEGIN);
      assertEquals(decoder.readToken()?.asString(), "key");
      assertEquals(decoder.readToken(), undefined);

      for (let i = 1024; i < value.length; i += 1024) {
        decoder.push(encodeText(value.slice(i, i + 1024)));
        assertEquals(decoder.readToken(), undefined);
      }

      decoder.push(encodeText('"}'));
      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.STRING);
      assertEquals(token?.asString(), value);
      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_END);
      assertEquals(decoder.readToken(), undefined);
    });

    await test.step("should preserve an escaped quote split across chunks", () => {
      const decoder = new JSONTextDecoder();
      const first = '{"key":"say ' + "\\";
      const second = '"hi\\""}';

      decoder.push(encodeText(first));

      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_BEGIN);
      assertEquals(decoder.readToken()?.asString(), "key");
      assertEquals(decoder.readToken(), undefined);

      decoder.push(encodeText(second));
      decoder.end();

      const token = decoder.readToken();

      assertEquals(token?.kind, KIND.STRING);
      assertEquals(token?.asString(), 'say "hi"');
      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_END);
      assertEquals(decoder.readToken(), undefined);
    });

    await test.step("should read a complete object value after a long string spans many chunks", () => {
      const value = "b".repeat(64 * 1024);
      const decoder = new JSONTextDecoder();

      decoder.push(encodeText(`{"key":"${value.slice(0, 1024)}`));

      assertEquals(decoder.readValue(), undefined);

      for (let i = 1024; i < value.length; i += 1024) {
        decoder.push(encodeText(value.slice(i, i + 1024)));
        assertEquals(decoder.readValue(), undefined);
      }

      decoder.push(encodeText('"}'));
      decoder.end();

      const parsed = decoder.readValue();

      assertEquals(parsed?.kind, KIND.OBJECT_BEGIN);
      assertEquals(parsed?.text(), `{"key":"${value}"}`);
      assertEquals(decoder.readValue(), undefined);
    });
  });

  await test.step("[scenario] options", async (test) => {
    await test.step("should reject duplicate names by default", () => {
      const encoded = encodeText('{"a":1,"a":2}');
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();
      decoder.readToken();
      decoder.readToken();

      assertThrows(() => decoder.readToken(), SyntaxError, "duplicate object name 'a'");
    });

    await test.step("should allow duplicate names when configured", () => {
      const encoded = encodeText('{"a":1,"a":2}');
      const decoder = new JSONTextDecoder(encoded, { allowDuplicateNames: true });

      decoder.end();
      decoder.readToken();
      decoder.readToken();
      decoder.readToken();
      decoder.readToken();
      decoder.readToken();

      assertEquals(decoder.readToken()?.kind, KIND.OBJECT_END);
    });
  });

  await test.step("[scenario] checkEOF", async (test) => {
    await test.step("should not throw when input is fully consumed", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();
      decoder.checkEOF();
    });

    await test.step("should throw when trailing characters remain", () => {
      const encoded = encodeText("42 extra");
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      assertThrows(() => decoder.checkEOF(), SyntaxError);
    });
  });

  await test.step("[scenario] inputOffset", async (test) => {
    await test.step("should return 0 before reading anything", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      assertEquals(decoder.inputOffset, 0);
    });

    await test.step("should advance after each token is read", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      assertEquals(decoder.inputOffset, 1);

      decoder.readToken();

      assertEquals(decoder.inputOffset, 2);
    });
  });

  await test.step("[scenario] unreadBytes", async (test) => {
    await test.step("should return all bytes before any token is read", () => {
      const json = JSON.stringify(42);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      assertEquals(decoder.unreadBytes, encoded);
    });

    await test.step("should return remaining bytes after reading a token", () => {
      const json = JSON.stringify([1, 2]);
      const encoded = encodeText(json);
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      assertEquals(decoder.unreadBytes, encodeText("1,2]"));
    });
  });

  await test.step("[scenario] malformed JSON", async (test) => {
    await test.step("should throw on an unterminated string", () => {
      const encoded = encodeText('"hello');
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();

      assertThrows(() => decoder.checkEOF(), SyntaxError);
    });

    await test.step("should throw SyntacticError on an invalid character", () => {
      const encoded = encodeText("@invalid");
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const error = assertThrows(() => decoder.readToken(), SyntacticError);

      assertEquals(error.offset, 0);
      assertEquals(error.pointer.toString(), "");
    });

    await test.step("should throw SyntacticError for a malformed null literal", () => {
      const encoded = encodeText("nulx");
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();

      const error = assertThrows(() => decoder.readToken(), SyntacticError);

      assertEquals(error.offset, 0);
      assertEquals(error.pointer.toString(), "");
      assertEquals(error.message, "Invalid literal null at offset 0");
    });

    await test.step("should include pointer path in SyntacticError within an object", () => {
      const encoded = encodeText('{"a": @}');
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();
      decoder.readToken();

      const error = assertThrows(() => decoder.readToken(), SyntacticError);

      assertEquals(error.offset, 6);
      assertEquals(error.pointer.toString(), "/a");
    });

    await test.step("should throw on mismatched closing bracket", () => {
      const encoded = encodeText("[1,2}");
      const decoder = new JSONTextDecoder(encoded);

      decoder.end();
      decoder.readToken();
      decoder.readToken();
      decoder.readToken();

      assertThrows(() => decoder.readToken(), SyntaxError);
    });
  });
});
