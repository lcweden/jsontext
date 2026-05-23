import { DEFAULT_DECODER_OPTIONS, KIND, MAX_NESTING_DEPTH } from "#src/common/constants";
import Decoder from "#src/modules/decoder";
import type { Matcher } from "#src/modules/path";
import Path from "#src/modules/path";
import type Value from "#src/modules/value";
import type { DecoderOptions } from "#src/types/options";
import { encodeText } from "#src/utils/text";

type JSONTextSelectorStreamOptions = DecoderOptions & {
  writableStrategy?: QueuingStrategy<Uint8Array>;
  readableStrategy?: QueuingStrategy<Value>;
};

class JSONTextSelectorStream extends TransformStream<Uint8Array, Value> {
  #decoder: Decoder;
  #matcher: Matcher;
  #indexes: Uint32Array;
  #types: Uint8Array;
  #pushs: Uint8Array;
  #depth: number;

  constructor(input: string, options: JSONTextSelectorStreamOptions = {}) {
    const { writableStrategy, readableStrategy, ...rest } = options;
    const decoderOptions = { ...DEFAULT_DECODER_OPTIONS, ...rest };

    super(
      {
        transform: (chunk, controller) => {
          this.#decoder.push(chunk);
          this.#drain(controller);
        },
        flush: (controller) => {
          this.#decoder.end();
          this.#drain(controller);
          this.#decoder.checkEOF();
        },
      },
      writableStrategy,
      readableStrategy,
    );

    this.#decoder = new Decoder(new Uint8Array(), decoderOptions);
    this.#matcher = new Path(encodeText(input)).createMatcher();
    this.#indexes = new Uint32Array(MAX_NESTING_DEPTH);
    this.#types = new Uint8Array(MAX_NESTING_DEPTH);
    this.#pushs = new Uint8Array(MAX_NESTING_DEPTH);
    this.#depth = 0;
  }

  #drain(controller: TransformStreamDefaultController<Value>): void {
    while (true) {
      const kind = this.#decoder.peekKind();

      if (kind === undefined) {
        break;
      }

      if (kind === KIND.OBJECT_END || kind === KIND.ARRAY_END) {
        this.#decoder.readToken();

        if (this.#depth > 0 && this.#pushs[this.#depth - 1] > 0) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          this.#depth--;

          if (this.#depth > 0) {
            const isObject = this.#types[this.#depth - 1] === 1;

            if (!isObject) {
              this.#indexes[this.#depth - 1]++;
            }
          }
        }

        continue;
      }

      if (this.#decoder.needObjectName()) {
        if (this.#decoder.readToken() === undefined) {
          return;
        }

        continue;
      }

      let pushed = false;

      if (this.#depth > 0) {
        const isObject = this.#types[this.#depth - 1] === 1;
        const step = isObject ? this.#decoder.lastObjectName() : this.#indexes[this.#depth - 1];

        this.#matcher.push(step);
        pushed = true;
      }

      const isContainer = kind === KIND.OBJECT_BEGIN || kind === KIND.ARRAY_BEGIN;

      if (this.#matcher.isAccepting()) {
        const value = this.#decoder.readValue();

        if (value === undefined) {
          if (pushed) {
            this.#matcher.pop();
          }

          return;
        }

        controller.enqueue(value);

        if (pushed) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          const isObject = this.#types[this.#depth - 1] === 1;

          if (!isObject) {
            this.#indexes[this.#depth - 1]++;
          }
        }

        continue;
      }

      if (!isContainer || this.#matcher.isDead()) {
        if (!this.#decoder.skipValue()) {
          if (pushed) {
            this.#matcher.pop();
          }

          return;
        }

        if (pushed) {
          this.#matcher.pop();
        }

        if (this.#depth > 0) {
          const isObject = this.#types[this.#depth - 1] === 1;

          if (!isObject) {
            this.#indexes[this.#depth - 1]++;
          }
        }

        continue;
      }

      this.#decoder.readToken();
      this.#types[this.#depth] = kind === KIND.OBJECT_BEGIN ? 1 : 0;
      this.#indexes[this.#depth] = 0;
      this.#pushs[this.#depth] = pushed ? 1 : 0;
      this.#depth++;
    }
  }
}

export default JSONTextSelectorStream;
export type { JSONTextSelectorStreamOptions };
