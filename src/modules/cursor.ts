/**
 * A sliding window cursor used by the Decoder to navigate through incoming stream chunks.
 *
 * @internal
 */
class Cursor {
  #baseOffset: number;
  #ended: boolean;
  #previousStart: number;
  #previousEnd: number;
  #peekPosition: number;
  #peekError: Error | null;
  #bytes: Uint8Array;

  /**
   * Creates a new Cursor instance starting with an initial chunk of bytes.
   *
   * @param bytes The initial Uint8Array chunk to read from.
   */
  constructor(bytes: Uint8Array) {
    this.#baseOffset = 0;
    this.#ended = false;
    this.#previousStart = 0;
    this.#previousEnd = 0;
    this.#peekPosition = 0;
    this.#peekError = null;
    this.#bytes = bytes;
  }

  /**
   * Indicates whether the underlying stream has completely ended (EOF).
   */
  get ended(): boolean {
    return this.#ended;
  }

  /**
   * The current active byte buffer.
   */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  /**
   * The start position of the previous chunk.
   */
  get previousStart(): number {
    return this.#previousStart;
  }

  set previousStart(value: number) {
    this.#previousStart = value;
  }

  /**
   * The end position of the previous chunk.
   */
  get previousEnd(): number {
    return this.#previousEnd;
  }

  set previousEnd(value: number) {
    this.#previousEnd = value;
  }

  /**
   * The current peek position within the byte buffer.
   */
  get peekPosition(): number {
    return this.#peekPosition;
  }

  set peekPosition(value: number) {
    this.#peekPosition = value;
  }

  /**
   * The current peek error, if any.
   */
  get peekError(): Error | null {
    return this.#peekError;
  }

  set peekError(value: Error | null) {
    this.#peekError = value;
  }

  /**
   * Appends a newly received chunk of bytes to the cursor.
   * - **Fast-Path**: If all previous bytes were consumed, it simply reassigns the internal pointer.
   * - **Slow-Path**: If there are unread bytes, it allocates a new buffer and merges them.
   *
   * @param bytes The new Uint8Array chunk arriving from the stream.
   */
  appendBytes(bytes: Uint8Array): void {
    const unread = this.unreadBytes();

    if (unread.length > 0) {
      const merged = new Uint8Array(unread.length + bytes.length);

      merged.set(unread, 0);
      merged.set(bytes, unread.length);

      this.#bytes = merged;
    } else {
      this.#bytes = bytes;
    }

    if (this.#peekPosition > 0) {
      this.#peekPosition -= this.#previousEnd;
    }

    this.#baseOffset += this.#previousEnd;
    this.#previousStart = 0;
    this.#previousEnd = 0;
  }

  /**
   * Discards the previously processed token bytes by advancing the start pointer.
   * This signals that the current memory region is no longer needed.
   */
  discardPrevious(): void {
    if (this.#previousStart < this.#previousEnd && this.#previousStart < this.#bytes.length) {
      this.#previousStart = this.#previousEnd;
    }
  }

  /**
   * Marks the cursor as ended, indicating that no more bytes will be received.
   */
  end(): void {
    this.#ended = true;
  }

  /**
   * Checks if it has reached the end of the current internal buffer
   * and requires more data from the stream to continue.
   *
   * @param position The current index being processed.
   * @returns `true` if more chunks need to be pulled from the stream, `false` otherwise.
   */
  needMore(position: number): boolean {
    return position === this.#bytes.length;
  }

  /**
   * Calculates the absolute offset in the entire stream for a given local buffer position.
   *
   * @param position The local index within the current chunk.
   * @returns The global byte offset from the very beginning of the stream.
   */
  offsetAt(position: number): number {
    return this.#baseOffset + position;
  }

  /**
   * Extracts the bytes of the most recently processed token.
   *
   * @returns A subarray representing the previous token.
   */
  previousBytes(): Uint8Array {
    return this.#bytes.subarray(this.#previousStart, this.#previousEnd);
  }

  /**
   * Calculates the absolute start offset of the most recently processed token.
   *
   * @returns The global byte offset from the very beginning of the stream.
   */
  previousOffsetStart(): number {
    return this.#baseOffset + this.#previousStart;
  }

  /**
   * Calculates the absolute end offset of the most recently processed token.
   *
   * @returns The global byte offset from the very beginning of the stream.
   */
  previousOffsetEnd(): number {
    return this.#baseOffset + this.#previousEnd;
  }

  /**
   * Extracts the bytes that have been read but not yet discarded, representing the unread portion of the buffer.
   *
   * @returns A subarray of the current buffer containing all unread bytes.
   */
  unreadBytes(): Uint8Array {
    return this.#bytes.subarray(this.#previousEnd, this.#bytes.length);
  }
}

export default Cursor;
