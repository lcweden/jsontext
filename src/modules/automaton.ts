import { MAX_NESTING_DEPTH } from "#src/common/constants";
import type { Kind } from "#src/common/types";
import Entry from "#src/modules/entry";

/** A state machine that enforces JSON syntax rules and tracks structural nesting depth. */
class Automaton {
  #last: Entry;
  #stack: Entry[];

  /** Creates a new Automaton instance. */
  constructor() {
    this.#last = new Entry("array");
    this.#stack = [];
  }

  /** The current structural nesting depth. */
  get depth(): number {
    return this.#stack.length + 1;
  }

  /** The current entry at the deepest active parsing context. */
  get last(): Entry {
    return this.#last;
  }

  /** The stack of parent entries representing the nesting history. */
  get stack(): Entry[] {
    return this.#stack;
  }

  /**
   * Asserts and appends a generic literal value to the current context.
   *
   * @throws {SyntaxError} If the current entry requires an object name.
   */
  appendLiteral(): void {
    if (this.#last.needsObjectName) {
      throw new SyntaxError("object name must be a string");
    }

    this.#last.increment();
  }

  /** Appends a string value without applying an object-name guard. */
  appendString(): void {
    this.#last.increment();
  }

  /**
   * Asserts and appends a number value to the current context.
   *
   * @throws {SyntaxError} If the current entry requires an object name.
   */
  appendNumber(): void {
    this.appendLiteral();
  }

  /**
   * Retrieves the structural entry at the specified depth index.
   *
   * @param index The index of the entry to retrieve.
   * @returns The entry at the specified index.
   */
  getEntry(index: number): Entry {
    if (index === this.#stack.length) {
      return this.#last;
    }

    return this.#stack[index];
  }

  /**
   * Pushes a new object structure `{` onto the state machine stack.
   *
   * @throws {SyntaxError} If the parent context requires an object name.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   */
  pushObject(): void {
    if (this.#last.needsObjectName) {
      throw new SyntaxError("object name must be a string");
    }

    if (this.#stack.length >= MAX_NESTING_DEPTH) {
      throw new RangeError("exceeded max depth");
    }

    this.#last.increment();
    this.#stack.push(this.#last);

    this.#last = new Entry("object");
  }

  /**
   * Resolves and pops the current object structure `}` from the stack.
   *
   * @throws {SyntaxError} If the current context is not an object, or if it is prematurely closed while expecting a value.
   */
  popObject(): void {
    if (!this.#last.isObject) {
      throw new SyntaxError("mismatching } for object");
    }

    if (this.#last.needsObjectValue) {
      throw new SyntaxError("missing value after object name");
    }

    const last = this.#stack.pop();

    if (last) {
      this.#last = last;
    }
  }

  /**
   * Pushes a new array structure `[` onto the state machine stack.
   *
   * @throws {SyntaxError} If the parent context requires an object name.
   * @throws {RangeError} If the maximum nesting depth is exceeded.
   */
  pushArray(): void {
    if (this.#last.needsObjectName) {
      throw new SyntaxError("object name must be a string");
    }

    if (this.#stack.length >= MAX_NESTING_DEPTH) {
      throw new RangeError("exceeded max depth");
    }

    this.#last.increment();
    this.#stack.push(this.#last);

    this.#last = new Entry("array");
  }

  /**
   * Resolves and pops the current array structure `]` from the stack.
   *
   * @throws {SyntaxError} If the current context is not an array, or if it's the implicit top-level array being closed.
   */
  popArray(): void {
    if (!this.#last.isArray || this.#stack.length === 0) {
      throw new SyntaxError("mismatching structural token for object or array");
    }

    const last = this.#stack.pop();

    if (last) {
      this.#last = last;
    }
  }

  /** Resets the automaton to its initial top-level array state. */
  reset(): void {
    this.#last = new Entry("array");
    this.#stack.length = 0;
  }

  /**
   * Determines whether an implicit delimiter is required before the next token.
   *
   * @param kind The kind of the next incoming token.
   * @returns `":"` if a colon is needed, `","` if a comma is needed, or `null` if no delimiter is expected.
   */
  requiredDelimiter(kind: Kind): ":" | "," | null {
    if (this.#last.needsImplicitColon) {
      return ":";
    }

    if (this.#last.needImplicitComma(kind) && this.#stack.length > 0) {
      return ",";
    }

    return null;
  }
}

export default Automaton;
