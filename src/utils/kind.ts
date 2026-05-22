import { ASCII, KIND } from "#src/common/constants.ts";
import type { Kind } from "#src/types/kind.ts";

const NORM_KIND: Record<number, Kind> = {
  [ASCII.LOWER_CASE_N]: KIND.NULL,
  [ASCII.LOWER_CASE_F]: KIND.FALSE,
  [ASCII.LOWER_CASE_T]: KIND.TRUE,
  [ASCII.QUOTE]: KIND.STRING,
  [ASCII.OPENING_BRACE]: KIND.OBJECT_BEGIN,
  [ASCII.CLOSING_BRACE]: KIND.OBJECT_END,
  [ASCII.OPENING_BRACKET]: KIND.ARRAY_BEGIN,
  [ASCII.CLOSING_BRACKET]: KIND.ARRAY_END,
  [ASCII.MINUS]: KIND.NUMBER,
  [ASCII.DIGIT_0]: KIND.NUMBER,
  [ASCII.DIGIT_1]: KIND.NUMBER,
  [ASCII.DIGIT_2]: KIND.NUMBER,
  [ASCII.DIGIT_3]: KIND.NUMBER,
  [ASCII.DIGIT_4]: KIND.NUMBER,
  [ASCII.DIGIT_5]: KIND.NUMBER,
  [ASCII.DIGIT_6]: KIND.NUMBER,
  [ASCII.DIGIT_7]: KIND.NUMBER,
  [ASCII.DIGIT_8]: KIND.NUMBER,
  [ASCII.DIGIT_9]: KIND.NUMBER,
};

/**
 * Normalizes a byte to its corresponding kind.
 * @param byte The byte to normalize.
 * @returns The corresponding kind.
 */
function normalize(byte: number): Kind | undefined {
  return NORM_KIND[byte];
}

export { normalize };
