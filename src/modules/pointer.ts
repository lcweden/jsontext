class Pointer {
  #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  static unescapeToken(token: string): string {
    if (!token.includes("~")) {
      return token;
    }

    return token.replaceAll("~1", "/").replaceAll("~0", "~");
  }

  static escapeToken(token: string): string {
    return token.replaceAll("~", "~0").replaceAll("/", "~1");
  }

  toString(): string {
    return this.#value;
  }
}

export default Pointer;
