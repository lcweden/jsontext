import { KIND } from "#src/common/constants";
import type { Kind } from "#src/types/kind";

/**
 * Represents a single depth level in the automaton stack, which can be either an object or an array.
 *
 * @internal
 */
class Entry {
  #type: "object" | "array";
  #count: number;

  /**
   * Creates a new Entry instance with the specified structural type.
   *
   * @param type The type of the entry, either "object" or "array".
   */
  constructor(type: "object" | "array") {
    this.#type = type;
    this.#count = 0;
  }

  /**
   * Returns the current count of elements in the entry.
   * - **Array**: the index of the next element.
   * - **Object**: the number of key-value half-steps processed.
   *
   * @returns The current element count.
   */
  get count(): number {
    return this.#count;
  }

  /**
   * Checks if the entry represents a JSON object.
   *
   * @returns `true` if the entry is an object, `false` otherwise.
   */
  get isObject(): boolean {
    return this.#type === "object";
  }

  /**
   * Checks if the entry represents a JSON array.
   *
   * @returns `true` if the entry is an array, `false` otherwise.
   */
  get isArray(): boolean {
    return this.#type === "array";
  }

  /**
   * Checks if the entry needs an implicit colon before the next element,
   * if it's an object expecting a value, the next token must be a colon (`:`).
   *
   * @returns `true` if the entry needs an implicit colon, `false` otherwise.
   */
  get needsImplicitColon(): boolean {
    return this.needsObjectValue;
  }

  /**
   * Checks if the entry expects an object name for the next token.
   * This is true when the structure is an object and the current count is even.
   *
   * @returns `true` if the next token must be a string serving as an object name, `false` otherwise.
   */
  get needsObjectName(): boolean {
    return this.isObject && this.#count % 2 === 0;
  }

  /**
   * Checks if the entry expects an object value for the next token.
   * This is true when the structure is an object and a key has just been processed (count is odd).
   *
   * @returns `true` if an object value is needed, `false` otherwise.
   */
  get needsObjectValue(): boolean {
    return this.isObject && this.#count % 2 === 1;
  }

  /**
   * Checks if the entry needs an implicit comma before the next element:
   *
   * | Condition                  | Description                                                                                                      |
   * | :------------------------- | :--------------------------------------------------------------------------------------------------------------- |
   * | Count > 0                  | There is at least one element already in the entry.                                                              |
   * | Don't need object value    | The entry is not expecting an object value, which means it's either an array or an object expecting a key.       |
   * | Not ending object or array | The next token is not an object end (`}`) or array end (`]`), which means we are still within the current entry. |
   *
   * @param next The kind of the next token to be processed.
   * @returns `true` if the entry needs an implicit comma, `false` otherwise.
   */
  needImplicitComma(next: Kind): boolean {
    const isObjectEnd = this.isObject && next === KIND.OBJECT_END;
    const isArrayEnd = this.isArray && next === KIND.ARRAY_END;

    return (!!this.count && !this.needsObjectValue && !isObjectEnd && !isArrayEnd);
  }

  /**
   * Increases the count of elements in the entry.
   */
  increment(): void {
    this.#count++;
  }

  /**
   * Decreases the count of elements in the entry.
   */
  decrement(): void {
    this.#count--;
  }
}

export default Entry;
