import { DEFAULT_ENCODER_OPTIONS } from "#src/common/constants";
import Encoder from "#src/modules/encoder";
import type Token from "#src/modules/token";
import type Value from "#src/modules/value";
import type { EncoderOptions } from "#src/types/options";

type JSONTextEncoderOptions = EncoderOptions;

class JSONTextEncoder {
  #encoder: Encoder;

  constructor(options?: JSONTextEncoderOptions) {
    this.#encoder = new Encoder({ ...DEFAULT_ENCODER_OPTIONS, ...options });
  }

  bytes(): Uint8Array {
    return this.#encoder.bytes();
  }

  depth(): number {
    return this.#encoder.depth();
  }

  outputOffset(): number {
    return this.#encoder.outputOffset();
  }

  reset(): void {
    this.#encoder.reset();
  }

  stackPointer(where: 0 | 1 | -1 = 1): string {
    return this.#encoder.stackPointer(where).toString();
  }

  writeToken(token: Token): void {
    this.#encoder.writeToken(token);
  }

  writeValue(value: Value): void {
    this.#encoder.writeValue(value);
  }
}

export default JSONTextEncoder;
export type { JSONTextEncoderOptions };
