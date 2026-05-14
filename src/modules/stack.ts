class ObjectNameStack {
  #names: Array<string>;

  constructor() {
    this.#names = [];
  }

  get length(): number {
    return this.#names.length;
  }

  getObjectName(depth: number): string {
    return this.#names[depth] ?? "";
  }

  pushObject(): void {
    this.#names.push("");
  }

  popObject(): void {
    this.#names.pop();
  }

  setLast(name: string): void {
    this.#names[this.#names.length - 1] = name;
  }
}

class ObjectNamespaceStack {
  #namespaces: Array<Set<string>>;

  constructor() {
    this.#namespaces = [];
  }

  pushObject(): void {
    this.#namespaces.push(new Set());
  }

  popObject(): void {
    this.#namespaces.pop();
  }

  insert(name: string): boolean {
    const namespaces = this.#namespaces[this.#namespaces.length - 1];

    if (namespaces.has(name)) {
      return false;
    }

    namespaces.add(name);

    return true;
  }
}

export { ObjectNamespaceStack, ObjectNameStack };
