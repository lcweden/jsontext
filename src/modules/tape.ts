class Tape {
  #baseOffset: number;
  #length: number;
  #bytes: Uint8Array;

  constructor() {
    this.#baseOffset = 0;
    this.#length = 0;
    this.#bytes = new Uint8Array(256);
  }

  get length(): number {
    return this.#length;
  }

  appendByte(byte: number): void {
    if (this.#length >= this.#bytes.length) {
      this.#grow(1);
    }

    this.#bytes[this.#length++] = byte;
  }

  appendBytes(bytes: Uint8Array): void {
    const length = this.#length + bytes.length;

    if (length > this.#bytes.length) {
      this.#grow(bytes.length);
    }

    this.#bytes.set(bytes, this.#length);
    this.#length += bytes.length;
  }

  bytes(): Uint8Array {
    return this.#bytes.subarray(0, this.#length);
  }

  outputOffset(): number {
    return this.#baseOffset + this.#length;
  }

  reset(): void {
    this.#length = 0;
    this.#baseOffset = 0;
  }

  takeBytes(): Uint8Array {
    const bytes = this.#bytes.slice(0, this.#length);

    this.#baseOffset += this.#length;
    this.#length = 0;

    return bytes;
  }

  truncate(length: number): void {
    if (length < this.#length) {
      this.#length = length;
    }
  }

  #grow(needed: number): void {
    const size = Math.max(this.#bytes.length * 2, this.#length + needed);
    const bytes = new Uint8Array(size);

    bytes.set(this.#bytes.subarray(0, this.#length));
    this.#bytes = bytes;
  }
}

export default Tape;
