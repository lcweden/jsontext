import { ASCII } from "#src/common/constants";
import { decodeText } from "#src/utils/text";

/**
 * Compares two strings by UTF-16 code unit order.
 *
 * @param a The first string to compare.
 * @param b The second string to compare.
 * @returns A negative number if `a` sorts before `b`, a positive number if it sorts after `b`, or `0` when both strings are equal.
 */
function compareUTF16(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Advances past JSON whitespace starting at a byte position.
 *
 * Only space, tab, line feed, and carriage return are treated as whitespace.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns The first position that does not contain JSON whitespace.
 */
function consumeWhitespace(bytes: Uint8Array, position: number): number {
  while (position < bytes.length) {
    const byte = bytes[position];

    if (byte > ASCII.SPACE) {
      break; // fast path for non-whitespace characters
    }

    if (
      byte === ASCII.SPACE ||
      byte === ASCII.LINE_FEED ||
      byte === ASCII.CARRIAGE_RETURN ||
      byte === ASCII.TAB
    ) {
      position++;
    } else {
      break;
    }
  }

  return position;
}

/**
 * Matches the `null` literal at a byte position.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns `4` when `null` starts at `position`, otherwise `0`.
 */
function consumeNull(bytes: Uint8Array, position: number): number {
  if (bytes.length - position >= 4) {
    if (
      bytes[position] === ASCII.LOWER_CASE_N &&
      bytes[position + 1] === ASCII.LOWER_CASE_U &&
      bytes[position + 2] === ASCII.LOWER_CASE_L &&
      bytes[position + 3] === ASCII.LOWER_CASE_L
    ) {
      return 4;
    }
  }

  return 0;
}

/**
 * Matches the `true` literal at a byte position.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns `4` when `true` starts at `position`, otherwise `0`.
 */
function consumeTrue(bytes: Uint8Array, position: number): number {
  if (bytes.length - position >= 4) {
    if (
      bytes[position] === ASCII.LOWER_CASE_T &&
      bytes[position + 1] === ASCII.LOWER_CASE_R &&
      bytes[position + 2] === ASCII.LOWER_CASE_U &&
      bytes[position + 3] === ASCII.LOWER_CASE_E
    ) {
      return 4;
    }
  }

  return 0;
}

/**
 * Matches the `false` literal at a byte position.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns `5` when `false` starts at `position`, otherwise `0`.
 */
function consumeFalse(bytes: Uint8Array, position: number): number {
  if (bytes.length - position >= 5) {
    if (
      bytes[position] === ASCII.LOWER_CASE_F &&
      bytes[position + 1] === ASCII.LOWER_CASE_A &&
      bytes[position + 2] === ASCII.LOWER_CASE_L &&
      bytes[position + 3] === ASCII.LOWER_CASE_S &&
      bytes[position + 4] === ASCII.LOWER_CASE_E
    ) {
      return 5;
    }
  }

  return 0;
}

/**
 * Consumes a complete JSON string literal from a byte position.
 *
 * Escapes, control characters, and optionally UTF-8 validity are checked by
 * the underlying resumable scanner. An incomplete or invalid string returns
 * `0`.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @param validateUTF8 Whether to reject invalid UTF-8 sequences.
 * @returns The number of bytes in the string literal, or `0` when it is incomplete or invalid.
 */
function consumeString(bytes: Uint8Array, position: number, validateUTF8 = true): number {
  const result = consumeStringResumable(bytes, position, 0, validateUTF8);

  return result.completed ? result.consumed : 0;
}

/**
 * Scans a JSON string literal and supports resuming from a previous chunk.
 *
 * When the string is incomplete, `consumed` is the relative scan offset to
 * use when continuing with the next chunk. When the string is complete,
 * `consumed` is its total byte length from `position`.
 *
 * @param bytes The current input chunk to scan.
 * @param position The position at which the string starts.
 * @param offset The relative scan offset returned for a previous incomplete chunk.
 * @param validateUTF8 Whether to reject invalid UTF-8 sequences.
 * @returns The scan result, including the consumed byte count and completion status. An invalid start or control character returns `{ consumed: 0, completed: false }`.
 */
function consumeStringResumable(
  bytes: Uint8Array,
  position: number,
  offset: number,
  validateUTF8 = true,
): { consumed: number; completed: boolean } {
  if (position >= bytes.length || bytes[position] !== ASCII.QUOTE) {
    return { consumed: 0, completed: false };
  }

  let inEscape = false;
  let index = offset > 0 ? position + offset : position + 1;

  for (; index < bytes.length; index++) {
    const byte = bytes[index];

    if (inEscape) {
      inEscape = false;
      continue;
    }

    if (byte === ASCII.BACKSLASH) {
      if (index === bytes.length - 1) {
        return { consumed: index - position, completed: false };
      }
      inEscape = true;
      continue;
    }

    if (byte < ASCII.SPACE) {
      return { consumed: 0, completed: false };
    }

    if (byte === ASCII.QUOTE) {
      const chunk = bytes.subarray(position, index);

      if (validateUTF8) {
        try {
          decodeText(chunk, true);
        } catch {
          return { consumed: 0, completed: false };
        }
      }

      return { consumed: index - position + 1, completed: true };
    }
  }

  return { consumed: index - position, completed: false };
}

/**
 * Scans a JSON number literal from a byte position.
 *
 * The result is the length of the valid number prefix. Delimiter validation is
 * performed by the parser after this helper returns.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns The length of the number literal, or `0` when the bytes do not begin a valid number.
 */
function consumeNumber(bytes: Uint8Array, position: number): number {
  if (position >= bytes.length) {
    return 0;
  }

  let index = position;

  if (bytes[index] === ASCII.MINUS) {
    index++;
  }

  if (index >= bytes.length) {
    return 0;
  }

  const start = bytes[index];

  if (start === ASCII.DIGIT_0) {
    index++;

    if (
      index < bytes.length &&
      bytes[index] >= ASCII.DIGIT_0 &&
      bytes[index] <= ASCII.DIGIT_9
    ) {
      return 0;
    }
  } else if (start >= ASCII.DIGIT_0 && start <= ASCII.DIGIT_9) {
    index++;

    while (
      index < bytes.length &&
      bytes[index] >= ASCII.DIGIT_0 &&
      bytes[index] <= ASCII.DIGIT_9
    ) {
      index++;
    }
  } else {
    return 0;
  }

  if (index < bytes.length && bytes[index] === ASCII.DOT) {
    index++;

    if (
      index >= bytes.length ||
      bytes[index] < ASCII.DIGIT_0 ||
      bytes[index] > ASCII.DIGIT_9
    ) {
      return 0;
    }

    while (
      index < bytes.length &&
      bytes[index] >= ASCII.DIGIT_0 &&
      bytes[index] <= ASCII.DIGIT_9
    ) {
      index++;
    }
  }

  if (
    index < bytes.length &&
    (bytes[index] === ASCII.LOWER_CASE_E ||
      bytes[index] === ASCII.UPPER_CASE_E)
  ) {
    index++;

    if (
      index < bytes.length &&
      (bytes[index] === ASCII.PLUS ||
        bytes[index] === ASCII.MINUS)
    ) {
      index++;
    }

    if (
      index >= bytes.length ||
      bytes[index] < ASCII.DIGIT_0 ||
      bytes[index] > ASCII.DIGIT_9
    ) {
      return 0;
    }

    while (
      index < bytes.length &&
      bytes[index] >= ASCII.DIGIT_0 &&
      bytes[index] <= ASCII.DIGIT_9
    ) {
      index++;
    }
  }

  return index - position;
}

/**
 * Scans a JSON string literal that contains no escapes.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns The length of the string literal, or `0` when it is incomplete or contains an escape, control character, or non-ASCII byte.
 */
function consumeSimpleString(bytes: Uint8Array, position: number): number {
  if (position >= bytes.length || bytes[position] !== ASCII.QUOTE) {
    return 0;
  }

  for (let index = position + 1; index < bytes.length; index++) { // skip the opening quote
    const byte = bytes[index];

    if (byte === ASCII.QUOTE) {
      return index - position + 1; // include the closing quote
    }

    if (
      byte < ASCII.SPACE ||
      byte >= ASCII.DELETE ||
      byte === ASCII.BACKSLASH
    ) {
      return 0;
    }
  }

  return 0;
}

/**
 * Scans an integer JSON number without a sign, fraction, or exponent.
 *
 * @param bytes The input bytes to scan.
 * @param position The position at which to start scanning.
 * @returns The length of the integer, or `0` when the bytes do not begin a simple number or are followed immediately by a fraction or exponent.
 */
function consumeSimpleNumber(bytes: Uint8Array, position: number): number {
  if (position >= bytes.length) {
    return 0;
  }

  const byte = bytes[position];
  let index = position + 1;

  if (byte >= ASCII.DIGIT_1 && byte <= ASCII.DIGIT_9) {
    while (index < bytes.length) {
      const byte = bytes[index];

      if (byte >= ASCII.DIGIT_0 && byte <= ASCII.DIGIT_9) {
        index++;
      } else {
        break;
      }
    }
  } else if (byte !== ASCII.DIGIT_0) {
    return 0;
  }

  if (index < bytes.length) {
    const next = bytes[index];

    if (next === ASCII.DOT || next === ASCII.LOWER_CASE_E || next === ASCII.UPPER_CASE_E) {
      return 0;
    }
  }

  return index - position;
}

export {
  compareUTF16,
  consumeFalse,
  consumeNull,
  consumeNumber,
  consumeSimpleNumber,
  consumeSimpleString,
  consumeString,
  consumeStringResumable,
  consumeTrue,
  consumeWhitespace,
};
