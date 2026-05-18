import { DEFAULT_DECODER_OPTIONS } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type Token from "#src/modules/token";
import type Value from "#src/modules/value";
import type { Kind } from "#src/types/kind";
import type { DecoderOptions } from "#src/types/options";

type JSONTextDecoderOptions = DecoderOptions;

class JSONTextDecoder {
  #decoder: Decoder;

  constructor(bytes = new Uint8Array(), options?: JSONTextDecoderOptions) {
    this.#decoder = new Decoder(bytes, { ...DEFAULT_DECODER_OPTIONS, ...options });
  }

  checkEOF(): void {
    this.#decoder.checkEOF();
  }

  depth(): number {
    return this.#decoder.depth();
  }

  end(): void {
    this.#decoder.end();
  }

  inputOffset(): number {
    return this.#decoder.inputOffset();
  }

  push(bytes: Uint8Array): void {
    this.#decoder.push(bytes);
  }

  peekKind(): Kind | undefined {
    return this.#decoder.peekKind();
  }

  reset(): void {
    this.#decoder.reset();
  }

  readToken(): Token | undefined {
    return this.#decoder.readToken();
  }

  readValue(): Value | undefined {
    return this.#decoder.readValue();
  }

  skipValue(): boolean {
    return this.#decoder.skipValue();
  }

  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#decoder.stackPointer(where).toString();
  }

  unreadBytes(): Uint8Array {
    return this.#decoder.unreadBytes();
  }
}

export default JSONTextDecoder;
export type { JSONTextDecoderOptions };
