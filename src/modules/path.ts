import { ASCII, SEGMENT, SELECTOR } from "#src/common/constants";
import type {
  ArraySliceSelector,
  IndexSelector,
  NameSelector,
  Segment,
  Selector,
  WildcardSelector,
} from "#src/types/path";
import { decodeText } from "#src/utils/text";
import { consumeNumber, consumeWhitespace } from "#src/utils/wire";

/**
 * Supports a subset of JSON Path syntax and provides an NFA-based matcher.
 *
 * Supported Components
 * - **Root Identifier**: `$`
 * - **Child Segment**: `.` or `[...]`
 * - **Descendant Segment**: `..`
 * - **Name Selector**: `.name` or `['name']`
 * - **Wildcard Selector**: `.*` or `[*]`
 * - **Index Selector (positive)**: `[1]`
 * - **Array Slice Selector (positive)**: `[0:5]` or `[::2]`
 *
 * @internal
 * @see https://www.rfc-editor.org/rfc/rfc9535
 * @example
 * ```javascript
 * const path = new Path(new TextEncoder().encode("$.store.book[0].title"));
 * ```
 */
class Path {
  #bytes: Uint8Array;
  #segments: Segment[];

  /**
   * Creates a `Path` instance.
   *
   * @param bytes - JSON Path in UTF-8 encoded bytes.
   * @throws {SyntaxError} If the path expression is invalid.
   */
  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#segments = this.#parse(bytes);
  }

  /**
   * Creates a `Matcher` for incrementally matching a JSON traversal against this path.
   *
   * @returns A new `Matcher` instance initialised to the start of this path.
   */
  createMatcher(): Matcher {
    return new Matcher(this.#segments);
  }

  /**
   * Returns the JSON Path as a string.
   *
   * @returns JSON Path in string format
   */
  toString(): string {
    return decodeText(this.#bytes);
  }

  /**
   * Parses the JSON Path expression from UTF-8 encoded bytes and constructs an array of `Segment` objects.
   *
   * @param bytes - JSON Path in UTF-8 encoded bytes.
   * @returns An array of `Segment` objects representing the parsed path.
   * @throws {SyntaxError} If the path expression is invalid.
   */
  #parse(bytes: Uint8Array): Segment[] {
    let index: number = 0;

    index = consumeWhitespace(bytes, index);

    if (index >= bytes.length) {
      throw new SyntaxError("unexpected end of input");
    }

    const byte: number = bytes[index];

    if (byte !== ASCII.DOLLAR_SIGN) {
      throw new SyntaxError(`path must start with '$'`);
    }

    index++;

    const segments: Segment[] = [];
    let isDescendant: boolean = false;

    while (index < bytes.length) {
      index = consumeWhitespace(bytes, index);

      if (index >= bytes.length) {
        break;
      }

      const type: Segment["type"] = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
      const byte: number = bytes[index];

      if (byte === ASCII.DOT) {
        index++;

        if (index < bytes.length && bytes[index] === ASCII.DOT) {
          isDescendant = true;
          index++;
        }

        if (index >= bytes.length) {
          throw new SyntaxError("unexpected end of path");
        }

        const byte: number = bytes[index];

        if (byte === ASCII.ASTERISK) {
          const type: Segment["type"] = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
          const selector: WildcardSelector = { type: SELECTOR.WILDCARD };
          const segment: Segment = { type, selectors: [selector] };

          segments.push(segment);
          isDescendant = false;
          index++;
        } else if (byte === ASCII.OPENING_BRACKET) {
          if (!isDescendant) {
            throw new SyntaxError("unexpected '[' after '.'");
          }

          continue;
        } else {
          const start: number = index;
          const isValidChar = (byte: number, index: number) => {
            if (
              (byte >= ASCII.UPPER_CASE_A && byte <= ASCII.UPPER_CASE_Z) ||
              (byte >= ASCII.LOWER_CASE_A && byte <= ASCII.LOWER_CASE_Z) ||
              byte === ASCII.UNDERSCORE ||
              byte >= ASCII.DELETE
            ) {
              return true;
            }

            if (index !== start && byte >= ASCII.DIGIT_0 && byte <= ASCII.DIGIT_9) {
              return true;
            }

            return false;
          };

          while (index < bytes.length && isValidChar(bytes[index], index)) {
            index++;
          }

          if (index === start) {
            throw new SyntaxError("expected a name after '.'");
          }

          const type: Segment["type"] = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
          const name: string = decodeText(bytes.subarray(start, index));
          const selector: NameSelector = { type: SELECTOR.NAME, name };
          const segment: Segment = { type, selectors: [selector] };

          segments.push(segment);
          isDescendant = false;
        }
      } else if (byte === ASCII.OPENING_BRACKET) {
        const selectors: Selector[] = [];

        index++;

        while (index < bytes.length) {
          index = consumeWhitespace(bytes, index);

          const byte = bytes[index];

          if (byte === ASCII.CLOSING_BRACKET) {
            break;
          }

          if (byte === ASCII.ASTERISK) {
            const selector: WildcardSelector = { type: SELECTOR.WILDCARD };

            selectors.push(selector);
            index++;
          } else if (byte === ASCII.QUOTE || byte === ASCII.SINGLE_QUOTE) {
            const quote: number = byte;

            index++;

            const start: number = index;
            let inEscape: boolean = false;

            while (index < bytes.length) {
              if (inEscape) {
                inEscape = false;
                index++;

                continue;
              }

              if (bytes[index] === ASCII.BACKSLASH) {
                inEscape = true;
                index++;

                continue;
              }

              if (bytes[index] === quote) {
                break;
              }

              index++;
            }

            if (index >= bytes.length) {
              throw new SyntaxError("unterminated string literal");
            }

            const name: string = decodeText(bytes.subarray(start, index));
            const selector: NameSelector = { type: SELECTOR.NAME, name };

            selectors.push(selector);
            index++;
          } else if (
            byte === ASCII.MINUS ||
            (byte >= ASCII.DIGIT_0 && byte <= ASCII.DIGIT_9) ||
            byte === ASCII.COLON
          ) {
            const size: number = consumeNumber(bytes, index);
            let start: number | undefined;

            if (size > 0) {
              start = Number.parseInt(decodeText(bytes.subarray(index, index + size)), 10);
              index += size;
            }

            index = consumeWhitespace(bytes, index);

            if (index < bytes.length && bytes[index] !== ASCII.COLON) {
              if (start === undefined) {
                throw new SyntaxError("unexpected token in bracket");
              }

              if (start < 0) {
                throw new SyntaxError("negative index is not supported");
              }

              const selector: IndexSelector = { type: SELECTOR.INDEX, index: start };

              selectors.push(selector);
            } else if (index < bytes.length && bytes[index] === ASCII.COLON) {
              index++;
              index = consumeWhitespace(bytes, index);

              const size: number = consumeNumber(bytes, index);
              let end: number | undefined;
              let step: number | undefined;

              if (size > 0) {
                end = Number.parseInt(decodeText(bytes.subarray(index, index + size)), 10);
                index += size;
              }

              index = consumeWhitespace(bytes, index);

              if (index < bytes.length && bytes[index] === ASCII.COLON) {
                index++;
                index = consumeWhitespace(bytes, index);

                const size: number = consumeNumber(bytes, index);

                if (size > 0) {
                  step = Number.parseInt(decodeText(bytes.subarray(index, index + size)), 10);
                  index += size;
                }
              }

              if (start !== undefined && start < 0) {
                throw new SyntaxError("negative slice start is not supported");
              }

              if (end !== undefined && end < 0) {
                throw new SyntaxError("negative slice end is not supported");
              }

              if (step !== undefined && step < 0) {
                throw new SyntaxError("negative slice step is not supported");
              }

              const selector: ArraySliceSelector = { type: SELECTOR.ARRAY_SLICE, start, end, step };

              selectors.push(selector);
            } else {
              throw new SyntaxError("unexpected token in bracket");
            }

            index = consumeWhitespace(bytes, index);

            if (index < bytes.length && bytes[index] === ASCII.COMMA) {
              index++;
            } else if (index < bytes.length && bytes[index] !== ASCII.CLOSING_BRACKET) {
              throw new SyntaxError("expected ',' or ']' in bracket");
            }
          } else {
            throw new SyntaxError(`unexpected token '${String.fromCharCode(byte)}' in bracket`);
          }

          index = consumeWhitespace(bytes, index);

          if (index < bytes.length && bytes[index] === ASCII.COMMA) {
            index++;
          } else if (index < bytes.length && bytes[index] !== ASCII.CLOSING_BRACKET) {
            throw new SyntaxError("expected ',' or ']' in bracket");
          }
        }

        if (index >= bytes.length || bytes[index] !== ASCII.CLOSING_BRACKET) {
          throw new SyntaxError("expected ']' in bracket");
        }

        index++;

        const segment = { type, selectors };

        segments.push(segment);
        isDescendant = false;
      } else {
        throw new SyntaxError(`unexpected token '${String.fromCharCode(byte)}'`);
      }
    }

    return segments;
  }
}

/**
 * NFA implementation for JSON Path matching.
 *
 * @internal
 */
class Matcher {
  #segments: Segment[];
  #stack: number[];
  #mask: number;

  /**
   * Creates a `Matcher` instance.
   *
   * @param segments - An array of `Segment` objects representing the parsed JSON Path.
   */
  constructor(segments: Segment[]) {
    // The maximum number of segments is limited to 30 to ensure that
    // the bitmask can represent all states within a single 32-bit.
    if (segments.length > 30) {
      throw new RangeError(`path has too many segments (max 30)`);
    }

    this.#segments = segments;
    this.#stack = [1];
    this.#mask = 1 << segments.length;
  }

  /**
   * Pushes a new step into the matcher state based on the current active states and the provided step.
   *
   * @param step JSON Object key or Array index.
   */
  push(step: string | number): void {
    const current: number = this.#stack[this.#stack.length - 1];
    let next: number = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const previous: number = 1 << i;

      if ((current & previous) === 0) {
        continue;
      }

      const segment: Segment = this.#segments[i];
      let matches: boolean = false;

      for (const selector of segment.selectors) {
        if (selector.type === SELECTOR.WILDCARD) {
          matches = true;

          break;
        }

        if (selector.type === SELECTOR.NAME && typeof step === "string") {
          if (selector.name === step) {
            matches = true;

            break;
          }

          continue;
        }

        if (selector.type === SELECTOR.INDEX && typeof step === "number") {
          if (!Number.isNaN(step) && step === selector.index) {
            matches = true;

            break;
          }

          continue;
        }

        if (selector.type === SELECTOR.ARRAY_SLICE && typeof step === "number") {
          if (Number.isNaN(step)) {
            continue;
          }

          const start = selector.start !== undefined ? selector.start : 0;
          const stride = selector.step !== undefined ? selector.step : 1;
          const end = selector.end;

          if (step < start) {
            continue;
          }

          if (end !== undefined && step >= end) {
            continue;
          }

          if ((step - start) % stride === 0) {
            matches = true;

            break;
          }
        }
      }

      if (segment.type === SEGMENT.DESCENDANT) {
        next |= 1 << i;

        if (matches) {
          next |= 1 << (i + 1);
        }
      } else if (matches) {
        next |= 1 << (i + 1);
      }
    }

    this.#stack.push(next);
  }

  /**
   * Pops the last step from the matcher state.
   */
  pop(): void {
    this.#stack.pop();
  }

  /**
   * Checks if the matcher is in an accepting state.
   *
   * @returns `true` if the matcher is accepting, `false` otherwise.
   */
  isAccepting(): boolean {
    return (this.#stack[this.#stack.length - 1] & this.#mask) !== 0;
  }

  /**
   * Checks if the matcher is in a dead state (i.e., no further transitions are possible).
   *
   * @returns `true` if the matcher is dead, `false` otherwise.
   */
  isDead(): boolean {
    return this.#stack[this.#stack.length - 1] === 0;
  }
}

export default Path;
export type { Matcher };
