class Cursor {
  #baseOffset: number;
  #ended: boolean;
  #previousStart: number;
  #previousEnd: number;
  #peekPosition: number;
  #peekError: Error | null;
  #bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.#baseOffset = 0;
    this.#ended = false;
    this.#previousStart = 0;
    this.#previousEnd = 0;
    this.#peekPosition = 0;
    this.#peekError = null;
    this.#bytes = bytes;
  }

  get ended(): boolean {
    return this.#ended;
  }

  get bytes(): Uint8Array {
    return this.#bytes;
  }

  get previousStart(): number {
    return this.#previousStart;
  }

  set previousStart(value: number) {
    this.#previousStart = value;
  }

  get previousEnd(): number {
    return this.#previousEnd;
  }

  set previousEnd(value: number) {
    this.#previousEnd = value;
  }

  get peekPosition(): number {
    return this.#peekPosition;
  }

  set peekPosition(value: number) {
    this.#peekPosition = value;
  }

  get peekError(): Error | null {
    return this.#peekError;
  }

  set peekError(value: Error | null) {
    this.#peekError = value;
  }

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

  discardPrevious(): void {
    if (this.#previousStart < this.#previousEnd && this.#previousStart < this.#bytes.length) {
      this.#previousStart = this.#previousEnd;
    }
  }

  end(): void {
    this.#ended = true;
  }

  needMore(position: number): boolean {
    return position === this.#bytes.length;
  }

  offsetAt(position: number): number {
    return this.#baseOffset + position;
  }

  previousBytes(): Uint8Array {
    return this.#bytes.subarray(this.#previousStart, this.#previousEnd);
  }

  previousOffsetStart(): number {
    return this.#baseOffset + this.#previousStart;
  }

  previousOffsetEnd(): number {
    return this.#baseOffset + this.#previousEnd;
  }

  unreadBytes(): Uint8Array {
    return this.#bytes.subarray(this.#previousEnd, this.#bytes.length);
  }
}

export default Cursor;
