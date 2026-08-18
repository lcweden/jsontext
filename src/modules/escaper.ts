import { UNICODE } from "#src/common/constants";
import { decodeText, encodeText } from "#src/utils/text";

/** Options for {@link Escaper}. */
type EscaperOptions = {
  /** Allow invalid UTF-8 byte sequences. By default, invalid sequences throw a `TypeError`. */
  allowInvalidUTF8: boolean;
  /** Normalize number tokens to their canonical decimal form. */
  canonicalizeRawNumbers: boolean;
  /** Escape `<`, `>`, and `&` for safe embedding in HTML. */
  escapeForHTML: boolean;
  /** Escape `\u2028` and `\u2029` for safe embedding in JavaScript string literals. */
  escapeForJS: boolean;
};

/** Handles string escaping for HTML and JavaScript contexts and canonicalizes raw numbers for JSON serialization. */
class Escaper {
  #options: EscaperOptions;
  #regexEscapeForHTML: RegExp;
  #regexLineSeparator: RegExp;
  #regexParagraphSeparator: RegExp;

  /**
   * Creates a new Escaper instance with the given options.
   *
   * @param options Escaper configuration options.
   */
  constructor(options: EscaperOptions) {
    this.#options = options;
    this.#regexEscapeForHTML = new RegExp("[<>&]", "g");
    this.#regexLineSeparator = new RegExp("\\u2028", "g");
    this.#regexParagraphSeparator = new RegExp("\\u2029", "g");
  }

  /**
   * Escapes raw UTF-8 bytes for a JSON string according to the configured HTML and JavaScript options.
   *
   * @param bytes The raw UTF-8 bytes of a JSON string.
   * @returns The escaped UTF-8 bytes.
   */
  escapeString(bytes: Uint8Array): Uint8Array {
    if (!this.#options.escapeForHTML && !this.#options.escapeForJS) {
      if (!this.#options.allowInvalidUTF8) {
        decodeText(bytes, true);
      }

      return bytes;
    }

    const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
    const parsed = JSON.parse(decoded);
    let encoded = JSON.stringify(parsed);

    if (this.#options.escapeForHTML) {
      encoded = encoded.replace(this.#regexEscapeForHTML, (substring) => {
        if (substring === "<") {
          return UNICODE.OPEN_ANGLED_BRACKET;
        }

        if (substring === ">") {
          return UNICODE.CLOSE_ANGLED_BRACKET;
        }

        return UNICODE.AMPERSAND;
      });
    }

    if (this.#options.escapeForJS) {
      encoded = encoded
        .replace(this.#regexLineSeparator, UNICODE.LINE_SEPARATOR)
        .replace(this.#regexParagraphSeparator, UNICODE.PARAGRAPH_SEPARATOR);
    }

    return encodeText(encoded);
  }

  /**
   * Canonicalizes raw UTF-8 bytes for a JSON number when canonicalization is enabled.
   *
   * @param bytes The raw UTF-8 bytes of a JSON number.
   * @returns The canonicalized (or unchanged) UTF-8 bytes.
   */
  canonicalizeNumber(bytes: Uint8Array): Uint8Array {
    if (!this.#options.canonicalizeRawNumbers) {
      return bytes;
    }

    const decoded = decodeText(bytes, !this.#options.allowInvalidUTF8);
    const parsed = JSON.parse(decoded);

    return encodeText(String(parsed));
  }
}

export default Escaper;
export type { EscaperOptions };
