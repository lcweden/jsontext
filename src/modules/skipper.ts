import { ASCII } from "#src/common/constants";

class Skipper {
  #depth: number;
  #inString: boolean;
  #inStringEscape: boolean;
  #offset: number;

  constructor() {
    this.#depth = 0;
    this.#inString = false;
    this.#inStringEscape = false;
    this.#offset = 0;
  }

  reset(): void {
    this.#depth = 0;
    this.#inString = false;
    this.#inStringEscape = false;
    this.#offset = 0;
  }

  skip(bytes: Uint8Array, start: number): number {
    let current = start + this.#offset;

    while (current < bytes.length) {
      const byte = bytes[current];

      if (this.#inString) {
        if (this.#inStringEscape) {
          this.#inStringEscape = false;
        } else if (byte === ASCII.BACKSLASH) {
          this.#inStringEscape = true;
        } else if (byte === ASCII.QUOTE) {
          this.#inString = false;
        }

        current++;
        continue;
      }

      switch (byte) {
        case ASCII.QUOTE: {
          this.#inString = true;
          break;
        }
        case ASCII.OPENING_BRACE:
        case ASCII.OPENING_BRACKET: {
          this.#depth++;
          break;
        }
        case ASCII.CLOSING_BRACE:
        case ASCII.CLOSING_BRACKET: {
          this.#depth--;
          break;
        }
      }

      current++;

      if (this.#depth === 0) {
        return (this.#offset = 0, current - start);
      }
    }

    return (this.#offset = current - start, 0);
  }
}

export default Skipper;
