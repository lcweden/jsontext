const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Encodes a string as UTF-8 bytes.
 *
 * @param input The string to encode.
 * @returns The encoded UTF-8 bytes.
 */
function encodeText(input: string): Uint8Array {
  return encoder.encode(input);
}

/**
 * Decodes UTF-8 bytes into a string.
 *
 * By default, invalid byte sequences are replaced according to the platform
 * `TextDecoder` behavior. Set `fatal` to `true` to reject invalid sequences.
 *
 * @param input The UTF-8 bytes to decode.
 * @param fatal Whether invalid UTF-8 should throw instead of being replaced.
 * @returns The decoded string.
 * @throws {TypeError} If `fatal` is `true` and `input` contains invalid UTF-8.
 */
function decodeText(input: Uint8Array, fatal?: boolean): string {
  return fatal ? fatalDecoder.decode(input) : decoder.decode(input);
}

export { decodeText, encodeText };
