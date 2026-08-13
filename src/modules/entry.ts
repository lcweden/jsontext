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

  /** The number of elements processed in this entry. */
  get count(): number {
    return this.#count;
  }

  /** Checks if the entry represents a JSON object. */
  get isObject(): boolean {
    return this.#type === "object";
  }

  /** Checks if the entry represents a JSON array. */
  get isArray(): boolean {
    return this.#type === "array";
  }

  /** Checks if the entry expects an implicit colon before the next element. */
  get needsImplicitColon(): boolean {
    return this.needsObjectValue;
  }

  /** Checks if the entry expects an object name for the next token. */
  get needsObjectName(): boolean {
    return this.isObject && this.#count % 2 === 0;
  }

  /** Checks if the entry expects an object value for the next token. */
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
