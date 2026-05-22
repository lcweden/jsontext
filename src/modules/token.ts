import { KIND } from "#src/common/constants.ts";
import type { Kind } from "#src/types/kind.ts";
import { normalize } from "#src/utils/kind.ts";
import { decodeText, encodeText } from "#src/utils/text.ts";

/**
 * Represents a single JSON token.
 *
 * A token is the smallest unit in a JSON document — either a scalar value
 * (`null`, `true`, `false`, a number, or a string) or a structural symbol
 * (`{`, `}`, `[`, `]`). Tokens hold their raw UTF-8 bytes and expose typed
 * accessor methods for converting to JavaScript primitives.
 */
class Token {
  #bytes: Uint8Array;
  #kind: Kind;

  /**
   * Creates a `Token` from raw UTF-8 bytes.
   *
   * @param bytes - Raw UTF-8 bytes of a single JSON token. Leading whitespace is not permitted.
   * @throws {RangeError} If `bytes` is empty.
   * @throws {SyntaxError} If the first byte does not correspond to a valid JSON token.
   */
  constructor(bytes: Uint8Array) {
    if (!bytes.length) {
      throw new RangeError("Token must have at least one byte");
    }

    const kind = normalize(bytes[0]);

    if (!kind) {
      throw new SyntaxError("Unexpected token kind: " + bytes[0]);
    }

    this.#bytes = bytes;
    this.#kind = kind;
  }

  /** The {@link Kind} of this token. */
  get kind(): Kind {
    return this.#kind;
  }

  /** The raw UTF-8 bytes of this token. */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  /** Pre-built `null` token. */
  static NULL: Token = Token.fromText("null");

  /** Pre-built `true` token. */
  static TRUE: Token = Token.fromText("true");

  /** Pre-built `false` token. */
  static FALSE: Token = Token.fromText("false");

  /** Pre-built `{` token. */
  static OBJECT_BEGIN: Token = Token.fromText("{");

  /** Pre-built `}` token. */
  static OBJECT_END: Token = Token.fromText("}");

  /** Pre-built `[` token. */
  static ARRAY_BEGIN: Token = Token.fromText("[");

  /** Pre-built `]` token. */
  static ARRAY_END: Token = Token.fromText("]");

  /**
   * Creates a `Token` from a raw JSON text string.
   *
   * The string must be a valid JSON token (e.g. `"true"`, `"42"`, `'"hello"'`,
   * `"{"`) with no surrounding whitespace.
   *
   * @param value - Raw JSON token text.
   * @returns A new `Token` parsed from the given text.
   * @throws {SyntaxError} If `value` is not a valid JSON token.
   * @example
   * const token = Token.fromText("true"); // or Token.fromText(JSON.stringify(true));
   * console.log(token.kind); // "true"
   * console.log(token.asBoolean()); // true
   */
  static fromText(value: string): Token {
    const encoded = encodeText(value);
    const token = new Token(encoded);

    return token;
  }

  /**
   * Creates a `Token` from a JavaScript boolean.
   *
   * @param value - The boolean to encode.
   * @returns `Token.TRUE` for `true`, `Token.FALSE` for `false`.
   */
  static fromBoolean(value: boolean): Token {
    return value ? Token.TRUE : Token.FALSE;
  }

  /**
   * Creates a `Token` from a JavaScript number.
   *
   * Non-finite values are encoded as JSON strings: `NaN` → `"NaN"`,
   * `Infinity` → `"Infinity"`, `-Infinity` → `"-Infinity"`.
   *
   * @param value - The number to encode.
   * @returns A number token, or a string token for non-finite values.
   */
  static fromNumber(value: number): Token {
    if (Number.isNaN(value)) {
      return Token.fromString("NaN");
    } else if (value === Number.POSITIVE_INFINITY) {
      return Token.fromString("Infinity");
    } else if (value === Number.NEGATIVE_INFINITY) {
      return Token.fromString("-Infinity");
    }

    const encoded = encodeText(JSON.stringify(value));
    const token = new Token(encoded);

    return token;
  }

  /**
   * Creates a `Token` from a JavaScript string.
   *
   * The string is JSON-encoded — surrounding quotes and escape sequences are
   * added automatically.
   *
   * @param value - The string value to encode.
   * @returns A string token whose bytes represent the JSON-encoded form.
   */
  static fromString(value: string): Token {
    const encoded = encodeText(JSON.stringify(value));
    const token = new Token(encoded);

    return token;
  }

  /**
   * Returns a deep copy of this token with an independent byte array.
   *
   * @returns A new `Token` backed by a cloned `Uint8Array`.
   */
  clone(): Token {
    return new Token(this.bytes.slice());
  }

  /**
   * Returns `true` if this token is a scalar value — `null`, `true`, `false`,
   * a number, or a string.
   *
   * @returns `true` for scalar tokens, `false` for structural tokens.
   */
  isScalar(): boolean {
    return (
      this.kind === KIND.STRING ||
      this.kind === KIND.NUMBER ||
      this.kind === KIND.TRUE ||
      this.kind === KIND.FALSE ||
      this.kind === KIND.NULL
    );
  }

  /**
   * Returns `true` if this token is a structural symbol — `{`, `}`, `[`, or `]`.
   *
   * @returns `true` for structural tokens, `false` for scalar tokens.
   */
  isStructural(): boolean {
    return (
      this.kind === KIND.OBJECT_BEGIN ||
      this.kind === KIND.OBJECT_END ||
      this.kind === KIND.ARRAY_BEGIN ||
      this.kind === KIND.ARRAY_END
    );
  }

  /**
   * Decodes this token as a JavaScript string.
   *
   * @returns The unescaped string value.
   * @throws {TypeError} If this token is not of kind {@link KIND.STRING}.
   */
  asString(): string {
    if (this.#kind !== KIND.STRING) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    const decoded = decodeText(this.#bytes, true);
    const result = JSON.parse(decoded);

    return result;
  }

  /**
   * Decodes this token as a JavaScript number.
   *
   * @returns The numeric value.
   * @throws {TypeError} If this token is not of kind {@link KIND.NUMBER}.
   */
  asNumber(): number {
    if (this.#kind !== KIND.NUMBER) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    const decoded = decodeText(this.#bytes, true);
    const result = JSON.parse(decoded);

    return result;
  }

  /**
   * Decodes this token as a JavaScript boolean.
   *
   * @returns `true` for `true` tokens, `false` for `false` tokens.
   * @throws {TypeError} If this token is not of kind {@link KIND.TRUE} or {@link KIND.FALSE}.
   */
  asBoolean(): boolean {
    if (this.#kind === KIND.TRUE) {
      return true;
    }

    if (this.#kind === KIND.FALSE) {
      return false;
    }

    throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
  }

  /**
   * Asserts that this token is `null` and returns `null`.
   *
   * @returns `null`.
   * @throws {TypeError} If this token is not of kind {@link KIND.NULL}.
   */
  asNull(): null {
    if (this.#kind !== KIND.NULL) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    return null;
  }
}

export default Token;
