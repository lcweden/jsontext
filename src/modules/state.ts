import Automaton from "#src/modules/automaton";
import Pointer from "#src/modules/pointer";
import { ObjectNamespaceStack, ObjectNameStack } from "#src/modules/stack";
import type { Kind } from "#src/types/kind";
import type { BaseOptions } from "#src/types/options";

/**
 * The central coordinator for the decoding/encoding state.
 *
 * @internal
 */
class State {
  #automaton: Automaton;
  #names: ObjectNameStack;
  #namespaces: ObjectNamespaceStack;
  #options: BaseOptions;

  /**
   * Creates a new State coordinator.
   *
   * @param options Decoder/encoder configuration options.
   */
  constructor(options: BaseOptions) {
    this.#automaton = new Automaton();
    this.#names = new ObjectNameStack();
    this.#namespaces = new ObjectNamespaceStack();
    this.#options = options;
  }

  /**
   * Returns the current nesting depth of the structural state.
   *
   * @returns The current nesting depth — `1` at the top level, incremented by each open object or array.
   */
  get depth(): number {
    return this.#automaton.depth;
  }

  /**
   * Retrieves the name of the currently active object property.
   *
   * @returns The current object property name, or an empty string if not inside an object.
   */
  get lastObjectName(): string {
    return this.#names.getLast();
  }

  /**
   * Checks if the current context expects an object key.
   *
   * @returns `true` if the next token must be a string serving as an object name, `false` otherwise.
   */
  get needsObjectName(): boolean {
    return this.#automaton.last.needsObjectName;
  }

  /**
   * Checks if the current context expects an object value.
   *
   * @returns `true` if an object value is needed, `false` otherwise.
   */
  get needsObjectValue(): boolean {
    return this.#automaton.last.needsObjectValue;
  }

  /**
   * Asserts and appends a generic literal value to the current context.
   *
   * @throws {SyntaxError} If the current entry requires an object name.
   */
  appendLiteral(): void {
    this.#automaton.appendLiteral();
  }

  /**
   * Appends a string value to the current context.
   */
  appendString(): void {
    this.#automaton.appendString();
  }

  /**
   * Asserts and appends a number value to the current context.
   *
   * @throws {SyntaxError} If the current entry requires an object name.
   */
  appendNumber(): void {
    this.#automaton.appendNumber();
  }

  /**
   * Determines if a delimiter (`:` or `,`) is required before the next token.
   *
   * @param kind The kind of the next incoming token.
   * @returns `":"` if a colon is needed, `","` if a comma is needed, or `null` if no delimiter is expected.
   */
  requiredDelimiter(kind: Kind): ":" | "," | null {
    return this.#automaton.requiredDelimiter(kind);
  }

  /**
   * Pushes a new array structure, synchronizing the underlying automaton.
   *
   * @throws {SyntaxError} If the parent context requires an object name.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   */
  pushArray(): void {
    this.#automaton.pushArray();
  }

  /**
   * Pops the current array structure.
   *
   * @throws {SyntaxError} If the current context is not an array, or if it is prematurely closed.
   */
  popArray(): void {
    this.#automaton.popArray();
  }

  /**
   * Pushes a new object structure.
   * Synchronizes the syntax automaton, name stack, and namespace stack.
   *
   * @throws {SyntaxError} If the parent context requires an object name.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   */
  pushObject(): void {
    this.#automaton.pushObject();
    this.#names.pushObject();
    this.#namespaces.pushObject();
  }

  /**
   * Pops the current object structure, cleaning up the associated name and namespace tracking.
   *
   * @throws {SyntaxError} If the current context is not an object, or if it is prematurely closed while expecting a value.
   */
  popObject(): void {
    this.#automaton.popObject();
    this.#names.popObject();
    this.#namespaces.popObject();
  }

  /**
   * Sets the name for the current object property and validates it against duplicates.
   *
   * @param name The object key being processed.
   * @throws {SyntaxError} If the name already exists in the current object and `allowDuplicateNames` is false.
   */
  setLast(name: string): void {
    this.#names.setLast(name);

    if (this.#options.allowDuplicateNames) {
      return;
    }

    if (!this.#namespaces.insert(name)) {
      throw new SyntaxError(`duplicate object name '${name}'`);
    }
  }

  /**
   * Dynamically generates a JSON Pointer (RFC 6901) representing a specific location
   * in the JSON structure relative to the current state.
   *
   * @param where `-1` for the previously processed value, `0` for the current scope, `1` for the next value.
   * @returns A `Pointer` instance representing the absolute path.
   * @example
   * ```javascript
   * // Object { "a": [...] } — one element at "/a/0" has just been written.
   * // state.pushObject(); state.setLast("a"); state.appendString();
   * // state.pushArray(); state.appendString()
   * state.stackPointer(-1) // "/a/0" — the previously written element
   * state.stackPointer(0)  // "/a"   — the current array at "a"
   * state.stackPointer(1)  // "/a/1" — the next element position
   * ```
   */
  stackPointer(where: -1 | 0 | 1): Pointer {
    const tokens: string[] = [];
    let depth = 0;

    for (let index = 1; index < this.#automaton.depth; index++) {
      const entry = this.#automaton.getEntry(index);
      let delta = -1;

      if (index === this.#automaton.depth - 1) {
        const isEmpty = where < 0 && entry.count === 0;
        const isNotInObject = where === 0 && !entry.needsObjectValue;
        const isExpectingName = where > 0 && entry.needsObjectName;

        if (isEmpty || isNotInObject || isExpectingName) {
          return new Pointer(tokens);
        }

        if (where > 0 && entry.isArray) {
          delta = 0;
        }
      }

      if (entry.isObject) {
        tokens.push(this.#names.getObjectName(depth));
        depth++;
      } else {
        tokens.push(String(entry.count + delta));
      }
    }

    return new Pointer(tokens);
  }
}

export default State;
