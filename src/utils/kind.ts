import { ASCII, KIND } from "#src/common/constants";
import type { Kind } from "#src/common/types";

/**
 * Maps a leading JSON byte to its token kind.
 *
 * @param byte The byte to map.
 * @returns The matching {@link Kind}, or `undefined` when the byte cannot begin a JSON token.
 */
function normalize(byte: number): Kind | undefined {
  switch (byte) {
    case ASCII.LOWER_CASE_N:
      return KIND.NULL;
    case ASCII.LOWER_CASE_F:
      return KIND.FALSE;
    case ASCII.LOWER_CASE_T:
      return KIND.TRUE;
    case ASCII.QUOTE:
      return KIND.STRING;
    case ASCII.OPENING_BRACE:
      return KIND.OBJECT_BEGIN;
    case ASCII.CLOSING_BRACE:
      return KIND.OBJECT_END;
    case ASCII.OPENING_BRACKET:
      return KIND.ARRAY_BEGIN;
    case ASCII.CLOSING_BRACKET:
      return KIND.ARRAY_END;
    case ASCII.MINUS:
    case ASCII.DIGIT_0:
    case ASCII.DIGIT_1:
    case ASCII.DIGIT_2:
    case ASCII.DIGIT_3:
    case ASCII.DIGIT_4:
    case ASCII.DIGIT_5:
    case ASCII.DIGIT_6:
    case ASCII.DIGIT_7:
    case ASCII.DIGIT_8:
    case ASCII.DIGIT_9:
      return KIND.NUMBER;
    default:
      return undefined;
  }
}

export { normalize };
