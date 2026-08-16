import { ASCII, KIND } from "#src/common/constants";
import Cursor from "#src/modules/cursor";
import Skipper from "#src/modules/skipper";
import type { Kind } from "#src/types/kind";
import { normalize } from "#src/utils/kind";
import {
  consumeFalse,
  consumeNull,
  consumeNumber,
  consumeSimpleNumber,
  consumeSimpleString,
  consumeStringResumable,
  consumeTrue,
  consumeWhitespace,
} from "#src/utils/wire";

class Scanner {
  #cursor: Cursor;
  #skipper: Skipper;
  #position: number;
  #checkpoint: number;
  #start: number;
  #length: number;
  #kind: Kind | undefined;
  #delimiter: ":" | "," | null;

  constructor() {
    this.#cursor = new Cursor();
    this.#skipper = new Skipper();
    this.#position = 0;
    this.#checkpoint = 0;
    this.#start = 0;
    this.#length = 0;
    this.#kind = undefined;
    this.#delimiter = null;
  }

  get delimiter(): ":" | "," | null {
    return this.#delimiter;
  }

  get kind(): Kind | undefined {
    return this.#kind;
  }

  get offset(): number {
    return this.#cursor.at(this.#position);
  }

  get span(): Uint8Array {
    return this.#cursor.bytes.subarray(this.#start, this.#start + this.#length);
  }

  get unreadBytes(): Uint8Array {
    return this.#cursor.bytes.subarray(this.#position);
  }

  appendBytes(chunk: Uint8Array): void {
    this.#cursor.append(chunk, this.#start);

    if (this.#position >= this.#start) {
      this.#position -= this.#start;
    } else {
      this.#position = 0;
    }

    this.#start = 0;
  }

  consumeToken(validateUTF8: boolean): boolean {
    if (!this.#kind) {
      return false;
    }

    let size = 0;

    switch (this.#kind) {
      case KIND.NULL: {
        const consumed = consumeNull(this.#cursor.bytes, this.#position);
        const failed = consumed === 0;
        const complete = this.#cursor.bytes.length - this.#position >= 4;

        if (failed && complete) {
          throw new SyntaxError("Invalid literal null");
        }

        size = consumed;
        break;
      }
      case KIND.TRUE: {
        const consumed = consumeTrue(this.#cursor.bytes, this.#position);
        const failed = consumed === 0;
        const complete = this.#cursor.bytes.length - this.#position >= 4;

        if (failed && complete) {
          throw new SyntaxError("Invalid literal true");
        }

        size = consumed;
        break;
      }
      case KIND.FALSE: {
        const consumed = consumeFalse(this.#cursor.bytes, this.#position);
        const failed = consumed === 0;
        const complete = this.#cursor.bytes.length - this.#position >= 5;

        if (failed && complete) {
          throw new SyntaxError("Invalid literal false");
        }

        size = consumed;
        break;
      }
      case KIND.NUMBER: {
        let consumed = consumeSimpleNumber(this.#cursor.bytes, this.#position);

        if (consumed === 0) {
          consumed = consumeNumber(this.#cursor.bytes, this.#position);
        }

        if (consumed === 0) {
          return false;
        }

        const exhausted = this.#position + consumed === this.#cursor.bytes.length;
        const active = !this.#cursor.ended;

        if (exhausted && active) {
          return false;
        }

        size = consumed;
        break;
      }
      case KIND.STRING: {
        const resuming = this.#checkpoint !== 0;

        if (!resuming) {
          const consumed = consumeSimpleString(this.#cursor.bytes, this.#position);

          if (consumed !== 0) {
            size = consumed;
            break;
          }
        }

        const { completed, consumed } = consumeStringResumable(
          this.#cursor.bytes,
          this.#position,
          this.#checkpoint,
          validateUTF8,
        );

        if (!completed) {
          return (this.#checkpoint = consumed, false);
        }

        this.#checkpoint = 0;
        size = consumed;
        break;
      }
      case KIND.OBJECT_BEGIN:
      case KIND.OBJECT_END:
      case KIND.ARRAY_BEGIN:
      case KIND.ARRAY_END: {
        size = 1;
        break;
      }
    }

    if (size === 0) {
      return false;
    }

    this.#start = this.#position;
    this.#length = size;
    this.#position += size;
    this.#kind = undefined;
    this.#delimiter = null;
    this.#skipper.reset();

    return true;
  }

  consumeValue(): boolean {
    if (!this.#kind) {
      return false;
    }

    const size = this.#skipper.skip(this.#cursor.bytes, this.#position);

    if (size === 0) {
      return false;
    }

    this.#start = this.#position;
    this.#length = size;
    this.#position += size;
    this.#kind = undefined;
    this.#delimiter = null;
    this.#skipper.reset();

    return true;
  }

  close(): void {
    this.#cursor.close();
  }

  findTrailingOffset(): number | undefined {
    const position = consumeWhitespace(this.#cursor.bytes, this.#start + this.#length);

    if (position < this.#cursor.bytes.length) {
      return this.#cursor.at(position);
    }

    return;
  }

  peekNext(): boolean {
    if (this.#kind) {
      return true;
    }

    this.#position = consumeWhitespace(this.#cursor.bytes, this.#position);

    if (this.#position >= this.#cursor.bytes.length) {
      return false;
    }

    const current = this.#cursor.bytes[this.#position];

    if (current === ASCII.COLON || current === ASCII.COMMA) {
      this.#delimiter = String.fromCharCode(current) as ":" | ",";
      this.#position++;
      this.#position = consumeWhitespace(this.#cursor.bytes, this.#position);

      if (this.#position >= this.#cursor.bytes.length) {
        return false;
      }
    }

    const next = this.#cursor.bytes[this.#position];
    const kind = normalize(next);

    if (!kind) {
      throw new SyntaxError(`Invalid character '${String.fromCharCode(next)}'`);
    }

    return (this.#kind = kind, true);
  }

  reset(): void {
    this.#cursor.reset();
    this.#skipper.reset();
    this.#position = 0;
    this.#checkpoint = 0;
    this.#start = 0;
    this.#length = 0;
    this.#kind = undefined;
    this.#delimiter = null;
  }
}

export default Scanner;
