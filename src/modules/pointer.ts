class Pointer {
  #tokens: string[];

  constructor(tokens: string[]) {
    this.#tokens = tokens;
  }

  get tokens(): string[] {
    return this.#tokens;
  }

  static parse(value: string): Pointer {
    if (value === "") {
      return new Pointer([]);
    }

    if (value[0] !== "/") {
      throw new TypeError("JSON Pointer must be empty or start with '/'");
    }

    return new Pointer(value.slice(1).split("/").map(Pointer.unescapeToken));
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
    if (this.#tokens.length === 0) {
      return "";
    }

    return "/" + this.#tokens.map(Pointer.escapeToken).join("/");
  }
}

export default Pointer;
