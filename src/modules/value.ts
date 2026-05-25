import { ASCII, DEFAULT_DECODER_OPTIONS, KIND } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type { Kind } from "#src/types/kind";
import { normalize } from "#src/utils/kind";
import { decodeText, encodeText } from "#src/utils/text";
import { compareUTF16, consumeWhitespace } from "#src/utils/wire";

/**
 * Represents a complete JSON value.
 *
 * A value is either a scalar (`null`, `true`, `false`, a number, or a string)
 * or a composite structure (an object or array, including all nested content).
 * Unlike {@link Token}, leading whitespace is accepted and preserved in
 * {@link bytes}.
 *
 * @public
 */
class Value {
  #bytes: Uint8Array;
  #kind: Kind;

  /**
   * Creates a `Value` from raw UTF-8 bytes.
   *
   * Leading whitespace is accepted and preserved in {@link bytes}.
   *
   * @param bytes - Raw UTF-8 bytes of a complete JSON value.
   * @throws {RangeError} If `bytes` is empty.
   * @throws {SyntaxError} If no valid JSON token is found after skipping leading whitespace.
   */
  constructor(bytes: Uint8Array) {
    if (!bytes.length) {
      throw new RangeError("Value must have at least one byte");
    }

    const position = consumeWhitespace(bytes, 0);

    if (position >= bytes.length) {
      throw new SyntaxError("Unexpected end of input");
    }

    const kind = normalize(bytes[position]);

    if (!kind) {
      throw new SyntaxError("Unexpected value kind: " + bytes[position]);
    }

    this.#bytes = bytes;
    this.#kind = kind;
  }

  /** The {@link Kind} of the top-level token of this value. */
  get kind(): Kind {
    return this.#kind;
  }

  /** The raw UTF-8 bytes of this value, including any leading whitespace. */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  /**
   * Creates a `Value` from any JavaScript value via `JSON.stringify`.
   *
   * @param input - Any JSON-serialisable value.
   * @returns A new `Value` whose bytes are the JSON representation of `input`.
   * @example
   * ```javascript
   * const value = Value.from({ a: 1, b: [true, null] });
   * console.log(value.text()); // '{"a":1,"b":[true,null]}'
   * ```
   */
  static from(input: unknown): Value {
    const json = JSON.stringify(input);
    const encoded = encodeText(json);

    return new Value(encoded);
  }

  /**
   * Returns a canonicalized copy of this value.
   *
   * Canonicalization recursively sorts object keys by UTF-16 code unit order
   * and normalizes numbers. The result is deterministic and idempotent.
   *
   * @returns A new `Value` in canonical form.
   * @throws {SyntacticError} If the bytes do not represent valid JSON.
   * @example
   * ```javascript
   * Value.from({ b: 2, a: 1 }).canonicalize().text() // '{"a":1,"b":2}'
   * Value.from([3, 1, 2]).canonicalize().text()       // '[3,1,2]' (arrays are not sorted)
   * ```
   */
  canonicalize(): Value {
    const decoder = new Decoder(this.#bytes, { allowDuplicateNames: true });
    decoder.end();

    return new Value(this.#processValue(decoder));
  }

  /**
   * Returns a deep copy of this value with an independent byte array.
   *
   * @returns A new `Value` backed by a cloned `Uint8Array`.
   */
  clone(): Value {
    return new Value(this.#bytes.slice());
  }

  /**
   * Returns `true` if the bytes represent a structurally valid, complete JSON
   * value with no trailing content.
   *
   * @returns `true` if valid, `false` otherwise. Never throws.
   */
  isValid(): boolean {
    try {
      const decoder = new Decoder(this.#bytes, {});

      decoder.end();

      const result = decoder.readValue();

      if (result === undefined) {
        return false;
      }

      decoder.checkEOF();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deserializes this value to a JavaScript value via `JSON.parse`.
   *
   * @returns The parsed JavaScript value.
   * @throws {SyntaxError} If the bytes do not represent valid JSON.
   */
  json(): unknown {
    return JSON.parse(this.text());
  }

  /**
   * Returns the UTF-8 string representation of this value.
   *
   * @returns The JSON text of this value.
   * @throws {TypeError} If the bytes contain invalid UTF-8 sequences.
   */
  text(): string {
    return decodeText(this.bytes, true);
  }

  /**
   * Returns a generator that yields each {@link Token} within this value in
   * document order.
   *
   * For scalar values, yields one token. For objects and arrays, yields all
   * tokens including structural delimiters, keys, and nested values.
   *
   * @yields {Token} Tokens in document order.
   * @throws {SyntacticError} If the bytes do not represent valid JSON.
   */
  *tokens(): Generator<Token> {
    const decoder = new Decoder(this.bytes, DEFAULT_DECODER_OPTIONS);

    while (true) {
      const token = decoder.readToken();

      if (token === undefined) {
        break;
      }

      yield token;
    }
  }

  /**
   * Recursively processes a single JSON value from the decoder, normalizing
   * numbers and dispatching composite values to `#processObject` or
   * `#processArray`.
   *
   * @param decoder The decoder positioned at the start of the value.
   * @returns The canonicalized UTF-8 bytes of the value.
   */
  #processValue(decoder: Decoder): Uint8Array {
    const kind = decoder.peekKind();

    if (kind === KIND.OBJECT_BEGIN) {
      return this.#processObject(decoder);
    }

    if (kind === KIND.ARRAY_BEGIN) {
      return this.#processArray(decoder);
    }

    if (kind === KIND.NUMBER) {
      const token = decoder.readToken()!;
      const decoded = decodeText(token.bytes, true);
      const parsed = JSON.parse(decoded);
      const encoded = encodeText(String(parsed));

      return encoded;
    }

    const token = decoder.readToken()!;

    return token.bytes;
  }

  /**
   * Consumes a JSON object from the decoder, sorts its members by key in
   * UTF-16 code unit order, and re-serializes them to canonical UTF-8 bytes.
   *
   * @param decoder The decoder positioned at the opening `{`.
   * @returns The canonicalized UTF-8 bytes of the object.
   */
  #processObject(decoder: Decoder): Uint8Array {
    decoder.readToken();

    const members: { name: string; key: Uint8Array; value: Uint8Array }[] = [];

    while (decoder.peekKind() !== KIND.OBJECT_END) {
      const token = decoder.readToken();

      if (token) {
        const decoded = decodeText(token.bytes, true);
        const parsed = JSON.parse(decoded);
        const value = this.#processValue(decoder);

        members.push({ name: parsed, key: token.bytes, value });
      }
    }

    decoder.readToken();

    members.sort((a, b) => compareUTF16(a.name, b.name));

    const parts: Uint8Array[] = [];
    const OPEN = new Uint8Array([ASCII.OPENING_BRACE]);
    const CLOSE = new Uint8Array([ASCII.CLOSING_BRACE]);
    const COLON = new Uint8Array([ASCII.COLON]);
    const COMMA = new Uint8Array([ASCII.COMMA]);

    parts.push(OPEN);

    for (let i = 0; i < members.length; i++) {
      if (i > 0) {
        parts.push(COMMA);
      }

      parts.push(members[i].key);
      parts.push(COLON);
      parts.push(members[i].value);
    }

    parts.push(CLOSE);

    const total = parts.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;

    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  /**
   * Consumes a JSON array from the decoder and re-serializes its elements
   * in their original order to UTF-8 bytes.
   *
   * @param decoder The decoder positioned at the opening `[`.
   * @returns The UTF-8 bytes of the re-serialized array.
   */
  #processArray(decoder: Decoder): Uint8Array {
    decoder.readToken();

    const items: Uint8Array[] = [];

    while (decoder.peekKind() !== KIND.ARRAY_END) {
      items.push(this.#processValue(decoder));
    }

    decoder.readToken();

    const OPEN = new Uint8Array([ASCII.OPENING_BRACKET]);
    const CLOSE = new Uint8Array([ASCII.CLOSING_BRACKET]);
    const COMMA = new Uint8Array([ASCII.COMMA]);
    const parts: Uint8Array[] = [OPEN];

    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        parts.push(COMMA);
      }

      parts.push(items[i]);
    }

    parts.push(CLOSE);

    const total = parts.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;

    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }
}

export default Value;
