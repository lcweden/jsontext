import { ASCII } from "#src/common/constants.ts";
import { decodeText } from "#src/utils/text.ts";

/**
 * Compares two strings by UTF-16 code unit order, as required by RFC 8785 §3.2.3.
 * @param a The first string to compare.
 * @param b The second string to compare.
 * @returns A negative number if a < b, positive if a > b, or 0 if equal.
 */
function compareUTF16(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Consumes whitespace characters from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume whitespace from.
 * @param position The position in the bytes to start consuming.
 * @returns The new position after consuming whitespace.
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
 * Consumes the "null" literal from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if the "null" literal is found, otherwise 0.
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
 * Consumes the "true" literal from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if the "true" literal is found, otherwise 0.
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
 * Consumes the "false" literal from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if the "false" literal is found, otherwise 0.
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
 * Consumes a string literal from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @param validateUTF8 Whether to validate the string as UTF-8.
 * @returns The number of bytes consumed if a string literal is found, otherwise 0.
 */
function consumeString(bytes: Uint8Array, position: number, validateUTF8 = true): number {
  if (position >= bytes.length || bytes[position] !== ASCII.QUOTE) {
    return 0;
  }

  let inEscape = false;

  for (let index = position + 1; index < bytes.length; index++) {
    const byte = bytes[index];

    if (inEscape) {
      inEscape = false;
      continue;
    }

    if (byte === ASCII.BACKSLASH) {
      inEscape = true;
      continue;
    }

    if (byte < ASCII.SPACE) {
      return 0;
    }

    if (byte === ASCII.QUOTE) {
      const chunk = bytes.subarray(position, index);

      if (validateUTF8) {
        try {
          decodeText(chunk, true);
        } catch (_error) {
          return 0;
        }
      }

      return index - position + 1;
    }
  }

  return 0;
}

/**
 * Consumes a number literal from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if a number literal is found, otherwise 0.
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
 * Consumes a simple string literal (without escape sequences) from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if a simple string literal is found, otherwise 0.
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
 * Consumes a simple number literal (without fractional or exponential parts) from the given position in the Uint8Array bytes.
 * @param bytes The Uint8Array bytes to consume from.
 * @param position The position in the bytes to start consuming.
 * @returns The number of bytes consumed if a simple number literal is found, otherwise 0.
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
  consumeTrue,
  consumeWhitespace,
};
