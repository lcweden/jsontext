import { ASCII, KIND } from "#src/common/constants";
import type { Kind } from "#src/common/types";
import { encodeText } from "#src/utils/text";

/** Options for {@link Formatter}. */
type FormatterOptions = {
  /** Indentation string used per nesting level when multiline is enabled. Defaults to two spaces. */
  indent: string;
  /** Prefix prepended to every indented line when multiline is enabled. */
  indentPrefix: string;
  /** Emit each value on its own line with indentation. */
  multiline: boolean;
  /** Emit a space after each `:` separator in objects. */
  spaceAfterColon: boolean;
  /** Emit a space after each `,` separator in arrays and objects. */
  spaceAfterComma: boolean;
};

/**
 * Handles whitespace and indentation formatting for JSON serialization.
 *
 * @internal
 */
class Formatter {
  #indentBytes: Uint8Array;
  #indentPrefixBytes: Uint8Array;
  #options: FormatterOptions;

  /**
   * Creates a new Formatter instance with the given options.
   *
   * @param options Formatter configuration options.
   */
  constructor(options: FormatterOptions) {
    this.#indentBytes = encodeText(options.indent);
    this.#indentPrefixBytes = encodeText(options.indentPrefix);
    this.#options = options;
  }

  /**
   * Computes whitespace chunks to insert before a token or value based on the
   * current delimiter, token kind, and structural depth.
   *
   * @param kind The {@link Kind} of token or value being formatted.
   * @param delimiter The delimiter required before this token (`:`, `,`, or `null`).
   * @param depth The current structural nesting depth.
   * @returns An array of byte chunks representing whitespace to insert.
   */
  getWhitespace(kind: Kind, delimiter: ":" | "," | null, depth: number): Uint8Array[] {
    const chunks: Uint8Array[] = [];

    if (delimiter === ":") {
      if (this.#options.spaceAfterColon) {
        chunks.push(new Uint8Array([ASCII.SPACE]));
      }

      return chunks;
    }

    if (delimiter === "," && this.#options.spaceAfterComma) {
      chunks.push(new Uint8Array([ASCII.SPACE]));
    }

    if (this.#options.multiline) {
      if (depth === 1) {
        return chunks;
      }

      const closed = kind === KIND.OBJECT_END || kind === KIND.ARRAY_END;
      const levels = closed ? depth - 2 : depth - 1;

      chunks.push(new Uint8Array([ASCII.LINE_FEED]));

      if (this.#options.indentPrefix) {
        chunks.push(this.#indentPrefixBytes);
      }

      for (let i = 0; i < levels; i++) {
        chunks.push(this.#indentBytes);
      }
    }

    return chunks;
  }
}

export default Formatter;
export type { FormatterOptions };
