import { ASCII, DEFAULT_DECODER_OPTIONS, KIND } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type { Kind } from "#src/types/kind";
import { normalize } from "#src/utils/kind";
import { decodeText, encodeText } from "#src/utils/text";
import { compareUTF16, consumeWhitespace } from "#src/utils/wire";

class Value {
  #bytes: Uint8Array;
  #kind: Kind;

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

  get kind() {
    return this.#kind;
  }

  get bytes() {
    return this.#bytes;
  }

  static from(input: unknown): Value {
    const json = JSON.stringify(input);
    const encoded = encodeText(json);

    return new Value(encoded);
  }

  canonicalize(): Value {
    const decoder = new Decoder(this.#bytes, { allowDuplicateNames: true });
    decoder.end();

    return new Value(this.#processValue(decoder));
  }

  clone(): Value {
    return new Value(this.#bytes.slice());
  }

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

  json(): unknown {
    return JSON.parse(this.text());
  }

  text(): string {
    return decodeText(this.bytes, { fatal: true });
  }

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
      const decoded = decodeText(token.bytes, { fatal: true });
      const parsed = JSON.parse(decoded);
      const encoded = encodeText(String(parsed));

      return encoded;
    }

    const token = decoder.readToken()!;

    return token.bytes;
  }

  #processObject(decoder: Decoder): Uint8Array {
    decoder.readToken();

    const members: { name: string; key: Uint8Array; value: Uint8Array }[] = [];

    while (decoder.peekKind() !== KIND.OBJECT_END) {
      const token = decoder.readToken();

      if (token) {
        const decoded = decodeText(token.bytes, { fatal: true });
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
