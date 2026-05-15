import { KIND } from "#src/common/constants";
import type { Kind } from "#src/types/kind";
import { normalize } from "#src/utils/kind";
import { decodeText, encodeText } from "#src/utils/text";

class Token {
  #bytes: Uint8Array;
  #kind: Kind;

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

  get kind() {
    return this.#kind;
  }

  get bytes() {
    return this.#bytes;
  }

  static fromText(value: string): Token {
    const encoded = encodeText(value);
    const token = new Token(encoded);

    return token;
  }

  static fromBoolean(value: boolean): Token {
    return value ? Token.fromText("true") : Token.fromText("false");
  }

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

  static fromString(value: string): Token {
    const encoded = encodeText(JSON.stringify(value));
    const token = new Token(encoded);

    return token;
  }

  clone(): Token {
    return new Token(this.bytes.slice());
  }

  isScalar(): boolean {
    return (
      this.kind === KIND.STRING ||
      this.kind === KIND.NUMBER ||
      this.kind === KIND.TRUE ||
      this.kind === KIND.FALSE ||
      this.kind === KIND.NULL
    );
  }

  isStructural(): boolean {
    return (
      this.kind === KIND.OBJECT_BEGIN ||
      this.kind === KIND.OBJECT_END ||
      this.kind === KIND.ARRAY_BEGIN ||
      this.kind === KIND.ARRAY_END
    );
  }

  asString(): string {
    if (this.#kind !== KIND.STRING) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    const decoded = decodeText(this.#bytes, { fatal: true });
    const result = JSON.parse(decoded);

    return result;
  }

  asNumber(): number {
    if (this.#kind !== KIND.NUMBER) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    const decoded = decodeText(this.#bytes, { fatal: true });
    const result = JSON.parse(decoded);

    return result;
  }

  asBoolean(): boolean {
    if (this.#kind === KIND.TRUE) {
      return true;
    }

    if (this.#kind === KIND.FALSE) {
      return false;
    }

    throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
  }

  asNull(): null {
    if (this.#kind !== KIND.NULL) {
      throw new TypeError(`invalid JSON token kind: ${this.#kind}`);
    }

    return null;
  }
}

export default Token;
