import { KIND } from "#src/common/constants";
import type { Kind } from "#src/types/kind";

class Entry {
  #type: "object" | "array";
  #count: number;

  constructor(type: "object" | "array" = "array") {
    this.#type = type;
    this.#count = 0;
  }

  count(): number {
    return this.#count;
  }

  isObject(): boolean {
    return this.#type === "object";
  }

  isArray(): boolean {
    return this.#type === "array";
  }

  needObjectName(): boolean {
    return this.isObject() && this.#count % 2 === 0;
  }

  needObjectValue(): boolean {
    return this.isObject() && this.#count % 2 === 1;
  }

  needImplicitColon(): boolean {
    return this.needObjectValue();
  }

  needImplicitComma(next: Kind): boolean {
    const isObjectEnd = this.isObject() && next === KIND.OBJECT_END;
    const isArrayEnd = this.isArray() && next === KIND.ARRAY_END;

    return (!!this.count() && !this.needObjectValue() && !isObjectEnd && !isArrayEnd);
  }

  increment(): void {
    this.#count++;
  }

  decrement(): void {
    this.#count--;
  }
}

export default Entry;
