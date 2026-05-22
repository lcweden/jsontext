import Automaton from "#src/modules/automaton.ts";
import Pointer from "#src/modules/pointer.ts";
import { ObjectNamespaceStack, ObjectNameStack } from "#src/modules/stack.ts";
import type { Kind } from "#src/types/kind.ts";
import type { BaseOptions } from "#src/types/options.ts";

class State {
  #automaton: Automaton;
  #names: ObjectNameStack;
  #namespaces: ObjectNamespaceStack;
  #options: BaseOptions;

  constructor(options: BaseOptions) {
    this.#automaton = new Automaton();
    this.#names = new ObjectNameStack();
    this.#namespaces = new ObjectNamespaceStack();
    this.#options = options;
  }

  appendLiteral(): void {
    this.#automaton.appendLiteral();
  }

  appendString(): void {
    this.#automaton.appendString();
  }

  appendNumber(): void {
    this.#automaton.appendNumber();
  }

  depth(): number {
    return this.#automaton.depth();
  }

  needDelimiter(kind: Kind): ":" | "," | null {
    return this.#automaton.needDelimiter(kind);
  }

  needObjectName(): boolean {
    return this.#automaton.last.needObjectName();
  }

  needObjectValue(): boolean {
    return this.#automaton.last.needObjectValue();
  }

  lastObjectName(): string {
    return this.#names.getLast();
  }

  pushArray(): void {
    this.#automaton.pushArray();
  }

  popArray(): void {
    this.#automaton.popArray();
  }

  pushObject(): void {
    this.#automaton.pushObject();
    this.#names.pushObject();
    this.#namespaces.pushObject();
  }

  popObject(): void {
    this.#automaton.popObject();
    this.#names.popObject();
    this.#namespaces.popObject();
  }

  setLast(name: string): void {
    this.#names.setLast(name);

    if (this.#options.allowDuplicateNames) {
      return;
    }

    if (!this.#namespaces.insert(name)) {
      throw new SyntaxError(`duplicate object name '${name}'`);
    }
  }

  stackPointer(where: -1 | 0 | 1): Pointer {
    const tokens: string[] = [];
    let depth = 0;

    for (let index = 1; index < this.#automaton.depth(); index++) {
      const entry = this.#automaton.getEntry(index);
      let delta = -1;

      if (index === this.#automaton.depth() - 1) {
        const isEmpty = where < 0 && entry.count() === 0;
        const isNotInObject = where === 0 && !entry.needObjectValue();
        const isExpectingName = where > 0 && entry.needObjectName();

        if (isEmpty || isNotInObject || isExpectingName) {
          return new Pointer(tokens);
        }

        if (where > 0 && entry.isArray()) {
          delta = 0;
        }
      }

      if (entry.isObject()) {
        tokens.push(this.#names.getObjectName(depth));
        depth++;
      } else {
        tokens.push(String(entry.count() + delta));
      }
    }

    return new Pointer(tokens);
  }
}

export default State;
