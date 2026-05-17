import { ASCII, SEGMENT, SELECTOR } from "#src/common/constants";
import type { Segment, Selector } from "#src/types/path";
import { decodeText } from "#src/utils/text";
import { consumeNumber, consumeWhitespace } from "#src/utils/wire";

class Path {
  #bytes: Uint8Array;
  #segments: Array<Segment>;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#segments = this.#parse(bytes);
  }

  match(tokens: string[]): boolean {
    if (this.#segments.length === 0) {
      return tokens.length === 0;
    }

    return this.#match(tokens, 0, 0);
  }

  toString(): string {
    return decodeText(this.#bytes);
  }

  #match(tokens: string[], segmentIndex: number, tokenIndex: number): boolean {
    if (segmentIndex === this.#segments.length) {
      return tokenIndex === tokens.length;
    }

    if (tokenIndex === tokens.length) {
      return false;
    }

    const segment = this.#segments[segmentIndex];

    switch (segment.type) {
      case SEGMENT.CHILD: {
        if (this.#isFulfilled(tokens[tokenIndex], segment.selectors)) {
          return this.#match(tokens, segmentIndex + 1, tokenIndex + 1);
        }

        return false;
      }
      case SEGMENT.DESCENDANT: {
        for (let index = tokenIndex; index < tokens.length; index++) {
          if (this.#isFulfilled(tokens[index], segment.selectors)) {
            if (this.#match(tokens, segmentIndex + 1, index + 1)) {
              return true;
            }
          }
        }

        return false;
      }
    }
  }

  #isFulfilled(token: string, selectors: Selector[]): boolean {
    for (const selector of selectors) {
      if (selector.type === SELECTOR.WILDCARD) {
        return true;
      }

      if (selector.type === SELECTOR.NAME) {
        if (selector.value === token) {
          return true;
        }
      }

      if (selector.type === SELECTOR.INDEX) {
        const index = Number.parseInt(token, 10);

        if (!Number.isNaN(index) && index === selector.value) {
          return true;
        }
      }

      if (selector.type === SELECTOR.ARRAY_SLICE) {
        const index = Number.parseInt(token, 10);

        if (Number.isNaN(index)) {
          continue;
        }

        const start = selector.start !== undefined ? selector.start : 0;
        const step = selector.step !== undefined ? selector.step : 1;
        const end = selector.end;

        if (index < start) {
          continue;
        }

        if (end !== undefined && index >= end) {
          continue;
        }

        if ((index - start) % step === 0) {
          return true;
        }
      }
    }

    return false;
  }

  #parse(bytes: Uint8Array): Array<Segment> {
    let index = 0;

    index = consumeWhitespace(bytes, index);

    if (index >= bytes.length || bytes[index] !== ASCII.DOLLAR_SIGN) {
      throw new SyntaxError("path must start with '$'");
    }

    index++;

    const segments: Segment[] = [];
    let isDescendant = false;

    while (index < bytes.length) {
      index = consumeWhitespace(bytes, index);

      if (index >= bytes.length) {
        break;
      }

      const byte = bytes[index];

      if (byte === ASCII.DOT) {
        index++;

        if (index < bytes.length && bytes[index] === ASCII.DOT) {
          isDescendant = true;
          index++;
        }

        if (index >= bytes.length) {
          throw new SyntaxError("unexpected end of path");
        }

        const byte = bytes[index];

        if (byte === ASCII.ASTERISK) {
          const type = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
          const selectors = [{ type: SELECTOR.WILDCARD }];
          const segment = { type, selectors };

          segments.push(segment);
          isDescendant = false;
          index++;
        } else if (byte === ASCII.OPENING_BRACKET) {
          if (!isDescendant) {
            throw new SyntaxError("unexpected '[' after '.'");
          }

          continue;
        } else {
          const start = index;
          const isValidChar = (byte: number, index: number) => {
            if (
              (byte >= ASCII.UPPER_CASE_A && byte <= ASCII.UPPER_CASE_Z) ||
              (byte >= ASCII.LOWER_CASE_A && byte <= ASCII.LOWER_CASE_Z) ||
              byte === 0x5f ||
              byte >= 0x80
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

          const type = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
          const value = decodeText(bytes.subarray(start, index));
          const selectors = [{ type: SELECTOR.NAME, value }];
          const segment = { type, selectors };

          segments.push(segment);
          isDescendant = false;
        }
      } else if (byte === ASCII.OPENING_BRACKET) {
        const selectors = [];

        index++;

        while (index < bytes.length) {
          index = consumeWhitespace(bytes, index);

          if (index >= bytes.length) {
            break;
          }

          const byte = bytes[index];

          if (byte === ASCII.CLOSING_BRACKET) {
            if (selectors.length === 0) {
              throw new SyntaxError("empty bracket selection is not allowed");
            }

            break;
          }

          if (byte === ASCII.ASTERISK) {
            const type = SELECTOR.WILDCARD;
            const selector = { type };

            selectors.push(selector);
            index++;
          } else if (byte === ASCII.SINGLE_QUOTE || byte === ASCII.QUOTE) {
            const quote = byte;

            index++;

            const start = index;
            let inEscape = false;

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

            const type = SELECTOR.NAME;
            const value = decodeText(bytes.subarray(start, index));
            const selector = { type, value };

            selectors.push(selector);
            index++;
          } else if (
            byte === ASCII.MINUS ||
            (byte >= ASCII.DIGIT_0 && byte <= ASCII.DIGIT_9) ||
            byte === ASCII.COLON
          ) {
            const size = consumeNumber(bytes, index);
            let start;

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

              const type = SELECTOR.INDEX;
              const value = start;
              const selector = { type, value };

              selectors.push(selector);
            } else if (index < bytes.length && bytes[index] === ASCII.COLON) {
              index++;
              index = consumeWhitespace(bytes, index);

              const size = consumeNumber(bytes, index);
              let end;
              let step;

              if (size > 0) {
                end = Number.parseInt(decodeText(bytes.subarray(index, index + size)), 10);
                index += size;
              }

              index = consumeWhitespace(bytes, index);

              if (index < bytes.length && bytes[index] === ASCII.COLON) {
                index++;
                index = consumeWhitespace(bytes, index);

                const size = consumeNumber(bytes, index);

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

              const type = SELECTOR.ARRAY_SLICE;
              const selector = { type, start, end, step };

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

        const type = isDescendant ? SEGMENT.DESCENDANT : SEGMENT.CHILD;
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

export default Path;
