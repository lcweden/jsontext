import { ASCII, KIND } from "#src/common/constants";
import type { Kind } from "#src/common/types";
import Cursor from "#src/modules/cursor";
import Skipper from "#src/modules/skipper";
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

/** Scans JSON input incrementally and exposes the next token or complete value span. */
class Scanner {
  #cursor: Cursor;
  #skipper: Skipper;
  #position: number;
  #checkpoint: number;
  #start: number;
  #length: number;
  #kind: Kind | undefined;
  #delimiter: ":" | "," | null;

  /** Creates a new scanner with an empty input buffer. */
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

  /** The delimiter found immediately before the current token, if any. */
  get delimiter(): ":" | "," | null {
    return this.#delimiter;
  }

  /** The kind of the next token, if one is ready. */
  get kind(): Kind | undefined {
    return this.#kind;
  }

  /** The absolute byte offset of the current scan position. */
  get offset(): number {
    return this.#cursor.at(this.#position);
  }

  /** The raw bytes of the most recently consumed token or value. */
  get span(): Uint8Array {
    return this.#cursor.bytes.subarray(this.#start, this.#start + this.#length);
  }

  /** The bytes that have not yet been consumed. */
  get unreadBytes(): Uint8Array {
    return this.#cursor.bytes.subarray(this.#position);
  }

  /** Appends an input chunk while retaining any incomplete token. */
  appendBytes(chunk: Uint8Array): void {
    this.#cursor.append(chunk, this.#start);

    if (this.#position >= this.#start) {
      this.#position -= this.#start;
    } else {
      this.#position = 0;
    }

    this.#start = 0;
  }

  /**
   * Consumes the currently prepared token.
   *
   * @param validateUTF8 Whether string tokens must contain valid UTF-8.
   * @returns `true` when a complete token was consumed, or `false` when more input is needed.
   * @throws {SyntaxError} If the token contains invalid literal or string syntax.
   */
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

  /**
   * Consumes the currently prepared complete value as one span.
   *
   * @returns `true` when a complete value was consumed, or `false` when more input is needed.
   */
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

  /** Marks the input as complete. */
  close(): void {
    this.#cursor.close();
  }

  /**
   * Finds the first non-whitespace byte after the most recently consumed value.
   *
   * @returns The absolute offset of trailing content, or `undefined` when none exists.
   */
  findTrailingOffset(): number | undefined {
    const position = consumeWhitespace(this.#cursor.bytes, this.#start + this.#length);

    if (position < this.#cursor.bytes.length) {
      return this.#cursor.at(position);
    }

    return;
  }

  /**
   * Scans whitespace and prepares the next token kind without consuming it.
   *
   * @returns `true` when a token is ready, or `false` when more input is needed.
   * @throws {SyntaxError} If the next non-whitespace byte cannot begin a JSON token.
   */
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

  /** Resets the scanner and clears all retained input state. */
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
