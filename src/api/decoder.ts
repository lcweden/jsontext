import Token from "#src/api/token";
import Value from "#src/api/value";
import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import type { Kind } from "#src/common/types";
import type { ParserOptions } from "#src/modules/parser";
import Parser from "#src/modules/parser";

/** Options for {@link JSONTextDecoder}. */
type JSONTextDecoderOptions = Partial<ParserOptions>;

class JSONTextDecoder {
  #parser: Parser;

  constructor(options?: JSONTextDecoderOptions) {
    this.#parser = new Parser({ ...DEFAULT_DECODER_OPTIONS, ...options });
  }

  get depth(): number {
    return this.#parser.depth;
  }

  get inputOffset(): number {
    return this.#parser.inputOffset;
  }

  get unreadBytes(): Uint8Array {
    return this.#parser.unreadBytes;
  }

  checkEOF(): void {
    this.#parser.checkEOF();
  }

  end(): void {
    this.#parser.close();
  }

  push(bytes: Uint8Array): void {
    this.#parser.push(bytes);
  }

  peekKind(): Kind | undefined {
    return this.#parser.peekKind();
  }

  reset(): void {
    this.#parser.reset();
  }

  readToken(): Token | undefined {
    const span = this.#parser.readToken();

    if (span === undefined) {
      return undefined;
    }

    return new Token(span);
  }

  readValue(): Value | undefined {
    const span = this.#parser.readValue();

    if (span === undefined) {
      return undefined;
    }

    return new Value(span);
  }

  skipValue(): boolean {
    return this.#parser.skipValue();
  }

  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#parser.stackPointer(where).toString();
  }
}

export default JSONTextDecoder;
export type { JSONTextDecoderOptions };
