/**
 * A dynamic, pre-allocated buffer used as the primary write destination for the Encoder.
 *
 * @internal
 */
class Tape {
  #baseOffset: number;
  #length: number;
  #bytes: Uint8Array;

  /**
   * Creates a new Tape instance with an initial buffer size of 256 bytes.
   */
  constructor() {
    this.#baseOffset = 0;
    this.#length = 0;
    this.#bytes = new Uint8Array(256);
  }

  /** The number of bytes currently written to the buffer. */
  get length(): number {
    return this.#length;
  }

  /**
   * Appends a single byte (0-255) to the buffer.
   * Doubles the underlying capacity if the buffer is full.
   *
   * @param byte The numeric ASCII/UTF-8 byte to append.
   */
  appendByte(byte: number): void {
    if (this.#length >= this.#bytes.length) {
      this.#grow(1);
    }

    this.#bytes[this.#length++] = byte;
  }

  /**
   * Appends a sequence of bytes to the buffer.
   * Dynamically grows the underlying capacity if the incoming chunk exceeds available space.
   *
   * @param bytes The Uint8Array chunk to append.
   */
  appendBytes(bytes: Uint8Array): void {
    const length = this.#length + bytes.length;

    if (length > this.#bytes.length) {
      this.#grow(bytes.length);
    }

    this.#bytes.set(bytes, this.#length);
    this.#length += bytes.length;
  }

  /**
   * Returns a view of the currently written bytes without advancing the output offset.
   *
   * @returns A subarray of the written bytes.
   */
  bytes(): Uint8Array {
    return this.#bytes.subarray(0, this.#length);
  }

  /**
   * Returns the absolute output byte offset, accumulating across all
   * {@link takeBytes} calls since the last {@link reset}.
   *
   * @returns The absolute output byte offset.
   */
  outputOffset(): number {
    return this.#baseOffset + this.#length;
  }

  /**
   * Resets the buffer, clearing all written bytes and resetting the base offset.
   */
  reset(): void {
    this.#length = 0;
    this.#baseOffset = 0;
  }

  /**
   * Extracts the currently written bytes and prepares the Tape for the next chunk of data.
   * This method advances the base offset and resets the length pointer to 0,
   * allowing the internal buffer to be safely overwritten (Buffer Reuse).
   *
   * @returns A copy (slice) of the bytes written so far.
   */
  takeBytes(): Uint8Array {
    const bytes = this.#bytes.slice(0, this.#length);

    this.#baseOffset += this.#length;
    this.#length = 0;

    return bytes;
  }

  /**
   * Truncates the buffer to a specific length, effectively discarding recent writes.
   *
   * @param length The target length to truncate to.
   */
  truncate(length: number): void {
    if (length < this.#length) {
      this.#length = length;
    }
  }

  /**
   * Grows the internal buffer to accommodate additional bytes.
   *
   * @param needed The number of additional bytes needed.
   */
  #grow(needed: number): void {
    const size = Math.max(this.#bytes.length * 2, this.#length + needed);
    const bytes = new Uint8Array(size);

    bytes.set(this.#bytes.subarray(0, this.#length));
    this.#bytes = bytes;
  }
}

export default Tape;
