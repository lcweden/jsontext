/**
 * Utility functions for encoding and decoding text.
 * @param input The input string to encode.
 * @returns A Uint8Array containing the encoded text.
 */
function encodeText(input: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(input);
}

/**
 * Utility functions for encoding and decoding text in UTF-8.
 * @param input The input Uint8Array to decode.
 * @param options Options for the TextDecoder.
 * @returns The decoded string.
 */
function decodeText(input: Uint8Array, options?: TextDecoderOptions): string {
  return new TextDecoder("utf-8", options).decode(input);
}

export { decodeText, encodeText };
