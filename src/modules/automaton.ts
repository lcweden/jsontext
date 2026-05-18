import { MAX_NESTING_DEPTH } from "#src/common/constants";
import Entry from "#src/modules/entry";
import type { Kind } from "#src/types/kind";

class Automaton {
  #last: Entry;
  #stack: Entry[];

  constructor() {
    this.#last = new Entry("array");
    this.#stack = [];
  }

  get last(): Entry {
    return this.#last;
  }

  get stack(): Entry[] {
    return this.#stack;
  }

  appendLiteral(): void {
    if (this.#last.needObjectName()) {
      throw new SyntaxError("object name must be a string");
    }

    this.#last.increment();
  }

  appendString(): void {
    this.#last.increment();
  }

  appendNumber(): void {
    this.appendLiteral();
  }

  depth(): number {
    return this.#stack.length + 1;
  }

  getEntry(index: number): Entry {
    if (index === this.#stack.length) {
      return this.#last;
    }

    return this.#stack[index];
  }

  pushObject(): void {
    if (this.#last.needObjectName()) {
      throw new SyntaxError("object name must be a string");
    }

    if (this.#stack.length >= MAX_NESTING_DEPTH) {
      throw new RangeError("exceeded max depth");
    }

    this.#last.increment();
    this.#stack.push(this.#last);

    this.#last = new Entry("object");
  }

  popObject(): void {
    if (!this.#last.isObject()) {
      throw new SyntaxError("mismatching } for object");
    }

    if (this.#last.needObjectValue()) {
      throw new SyntaxError("missing value after object name");
    }

    const last = this.#stack.pop();

    if (last) {
      this.#last = last;
    }
  }

  pushArray(): void {
    if (this.#last.needObjectName()) {
      throw new SyntaxError("object member name must be a string");
    }

    if (this.#stack.length === MAX_NESTING_DEPTH) {
      throw new RangeError("exceeded max depth");
    }

    this.#last.increment();
    this.#stack.push(this.#last);

    this.#last = new Entry("array");
  }

  popArray(): void {
    if (!this.#last.isArray() || this.#stack.length === 0) {
      throw new SyntaxError("mismatching structural token for object or array");
    }

    const last = this.#stack.pop();

    if (last) {
      this.#last = last;
    }
  }

  needDelimiter(kind: Kind): ":" | "," | null {
    if (this.#last.needImplicitColon()) {
      return ":";
    }

    if (this.#last.needImplicitComma(kind) && this.#stack.length > 0) {
      return ",";
    }

    return null;
  }
}

export default Automaton;
