/** Represents a JSON Pointer and its unescaped reference tokens. */
class Pointer {
  #tokens: string[];

  /**
   * Creates a new Pointer instance with the specified tokens.
   *
   * @param tokens An array of unescaped tokens representing the path segments of the pointer.
   */
  constructor(tokens: string[]) {
    this.#tokens = tokens;
  }

  /** The array of unescaped reference tokens representing the path. */
  get tokens(): string[] {
    return this.#tokens;
  }

  /**
   * Parses a JSON Pointer string into a `Pointer` instance.
   *
   * @param value A JSON Pointer string such as `""` or `"/foo/bar"`.
   * @returns A parsed `Pointer` object.
   * @throws {TypeError} If the string is not empty and does not start with `/`.
   * @example
   * ```javascript
   * Pointer.parse("").tokens         // []
   * Pointer.parse("/foo/bar").tokens // ["foo", "bar"]
   * Pointer.parse("/a~1b").tokens    // ["a/b"]
   * ```
   */
  static parse(value: string): Pointer {
    if (value === "") {
      return new Pointer([]);
    }

    if (value[0] !== "/") {
      throw new TypeError("JSON Pointer must be empty or start with '/'");
    }

    return new Pointer(value.slice(1).split("/").map(Pointer.unescapeToken));
  }

  /**
   * Unescapes a single reference token according to RFC 6901.
   * Converts `~1` back to `/`, and `~0` back to `~`.
   *
   * @param token The escaped token segment.
   * @returns The raw, unescaped string.
   */
  static unescapeToken(token: string): string {
    if (!token.includes("~")) {
      return token;
    }

    return token.replaceAll("~1", "/").replaceAll("~0", "~");
  }

  /**
   * Escapes a single reference token according to RFC 6901.
   * Converts `~` to `~0`, and `/` to `~1`.
   *
   * @param token The raw string segment.
   * @returns The escaped token segment safe for pointer construction.
   */
  static escapeToken(token: string): string {
    return token.replaceAll("~", "~0").replaceAll("/", "~1");
  }

  /**
   * Serializes the pointer back into a JSON Pointer string.
   *
   * @returns The serialized pointer string, or `""` for the root pointer.
   * @example
   * ```ts
   * Pointer.parse("/foo/bar").toString() // "/foo/bar"
   * Pointer.parse("").toString()         // ""
   * new Pointer(["a/b", "c"]).toString() // "/a~1b/c"
   * ```
   */
  toString(): string {
    if (this.#tokens.length === 0) {
      return "";
    }

    return "/" + this.#tokens.map(Pointer.escapeToken).join("/");
  }
}

export default Pointer;
