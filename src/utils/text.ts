const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Utility functions for encoding and decoding text.
 * @param input The input string to encode.
 * @returns A Uint8Array containing the encoded text.
 */
function encodeText(input: string): Uint8Array {
  return encoder.encode(input);
}

/**
 * Utility functions for encoding and decoding text in UTF-8.
 * @param input The input Uint8Array to decode.
 * @param fatal Whether to use a fatal decoder.
 * @returns The decoded string.
 */
function decodeText(input: Uint8Array, fatal?: boolean): string {
  return fatal ? fatalDecoder.decode(input) : decoder.decode(input);
}

export { decodeText, encodeText };
