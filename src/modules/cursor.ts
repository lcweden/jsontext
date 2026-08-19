/** Maintains the retained bytes and absolute offset of an incremental input stream. */
class Cursor {
  #bytes: Uint8Array;
  #ended: boolean;
  #owned: boolean;
  #offset: number;

  /** Creates a new Cursor instance. */
  constructor() {
    this.#bytes = new Uint8Array();
    this.#ended = false;
    this.#offset = 0;
    this.#owned = false;
  }

  /** The current active byte buffer. */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  /** Indicates whether the underlying stream has completely ended. */
  get ended(): boolean {
    return this.#ended;
  }

  /**
   * Appends a newly received chunk and discards previously consumed data.
   *
   * @param chunk New bytes from the stream.
   * @param start Number of bytes already consumed from the current buffer.
   */
  append(chunk: Uint8Array, start: number): void {
    const retainedLength = this.#bytes.length - start;
    const newLength = retainedLength + chunk.length;

    this.#offset += start;

    if (retainedLength === 0) {
      this.#bytes = chunk;
      this.#owned = false;

      return;
    }

    if (this.#owned && newLength <= this.#bytes.buffer.byteLength) {
      const buffer = this.#bytes.buffer;
      const current = new Uint8Array(buffer);

      current.copyWithin(0, start, start + retainedLength);

      this.#bytes = new Uint8Array(buffer, 0, newLength);
      this.#bytes.set(chunk, retainedLength);
    } else {
      const capacity = this.#owned ? this.#bytes.buffer.byteLength : 0;
      const doubling = Math.max(newLength, capacity * 2);
      const next = new Uint8Array(doubling);

      next.set(this.#bytes.subarray(start), 0);
      next.set(chunk, retainedLength);

      this.#bytes = new Uint8Array(next.buffer, 0, newLength);
      this.#owned = true;
    }
  }

  /**
   * Calculates the absolute stream offset for a position in the retained buffer.
   *
   * @param position The position within the current retained buffer.
   * @returns The byte offset from the beginning of the stream.
   */
  at(position: number): number {
    return this.#offset + position;
  }

  /** Marks the cursor as ended so no more bytes can be received. */
  close(): void {
    this.#ended = true;
  }

  /** Resets the cursor, clearing its buffer and offsets. */
  reset(): void {
    this.#bytes = new Uint8Array();
    this.#ended = false;
    this.#offset = 0;
    this.#owned = false;
  }
}

export default Cursor;
