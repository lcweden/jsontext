import type { Kind } from "#src/common/types";
import Automaton from "#src/modules/automaton";
import Pointer from "#src/modules/pointer";
import { ObjectNamespaceStack, ObjectNameStack } from "#src/modules/stack";

/** Options for {@link State}. */
type StateOptions = {
  /** Allow duplicate object key names. By default, duplicate names throw a `SyntacticError`. */
  allowDuplicateNames: boolean;
};

/** Coordinates syntax validation and location tracking for decoding and encoding. */
class State {
  #automaton: Automaton;
  #names: ObjectNameStack;
  #namespaces: ObjectNamespaceStack;
  #options: StateOptions;

  /**
   * Creates a new State coordinator.
   *
   * @param options Decoder/encoder configuration options.
   */
  constructor(options: StateOptions) {
    this.#automaton = new Automaton();
    this.#names = new ObjectNameStack();
    this.#namespaces = new ObjectNamespaceStack();
    this.#options = options;
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#automaton.depth;
  }

  /** The last object name processed in the current context. */
  get lastObjectName(): string {
    return this.#names.getLast();
  }

  /** Checks if the current context expects an object name. */
  get needsObjectName(): boolean {
    return this.#automaton.last.needsObjectName;
  }

  /** Checks if the current context expects an object value. */
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

  /** Appends a string value to the current context. */
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
   * @param kind The kind of the next token.
   * @returns `":"` for a colon, `","` for a comma, or `null`.
   */
  requiredDelimiter(kind: Kind): ":" | "," | null {
    return this.#automaton.requiredDelimiter(kind);
  }

  /**
   * Pushes a new array structure, synchronizing the underlying automaton.
   *
   * @throws {SyntaxError} If an object name is required.
   * @throws {RangeError} If maximum nesting depth is exceeded.
   */
  pushArray(): void {
    this.#automaton.pushArray();
  }

  /**
   * Pops the current array structure.
   *
   * @throws {SyntaxError} If the context is not an array or closes prematurely.
   */
  popArray(): void {
    this.#automaton.popArray();
  }

  /**
   * Pushes a new object structure.
   * Synchronizes the syntax automaton, name stack, and namespace stack.
   *
   * @throws {SyntaxError} If an object name is required.
   * @throws {RangeError} If maximum nesting depth is exceeded.
   */
  pushObject(): void {
    this.#automaton.pushObject();
    this.#names.pushObject();
    this.#namespaces.pushObject();
  }

  /**
   * Pops the current object structure, cleaning up the associated name and namespace tracking.
   *
   * @throws {SyntaxError} If the context is not an object or closes before a value.
   */
  popObject(): void {
    this.#automaton.popObject();
    this.#names.popObject();
    this.#namespaces.popObject();
  }

  /**
   * Resets the entire state, clearing the automaton, name stack, and namespace stack.
   */
  reset(): void {
    this.#automaton.reset();
    this.#names.reset();
    this.#namespaces.reset();
  }

  /**
   * Sets the name for the current object property and validates it against duplicates.
   *
   * @param name The object key being processed.
   * @throws {SyntaxError} If the name is a duplicate and duplicates are disallowed.
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
   * @param where Relative position: `-1` previous, `0` current, or `1` next.
   * @returns A `Pointer` for the selected position.
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
export type { StateOptions };
