import { ASCII } from "#src/common/constants";

/** Skips complete JSON values while preserving progress across input chunks. */
class Skipper {
  #depth: number;
  #inString: boolean;
  #inStringEscape: boolean;
  #offset: number;

  /** Creates a new value skipper. */
  constructor() {
    this.#depth = 0;
    this.#inString = false;
    this.#inStringEscape = false;
    this.#offset = 0;
  }

  /** Resets the skipper to its initial state. */
  reset(): void {
    this.#depth = 0;
    this.#inString = false;
    this.#inStringEscape = false;
    this.#offset = 0;
  }

  /**
   * Scans for the end of the JSON value beginning at `start`.
   *
   * @param bytes The input bytes to scan.
   * @param start The position at which the value begins.
   * @returns The value length, or `0` when more input is needed.
   */
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
