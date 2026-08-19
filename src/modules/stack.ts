/** A specialized stack for tracking the current property names of nested JSON objects. */
class ObjectNameStack {
  #names: Array<string>;

  /** Creates a new ObjectNameStack instance. */
  constructor() {
    this.#names = [];
  }

  /** The current depth of tracked object names. */
  get length(): number {
    return this.#names.length;
  }

  /**
   * Retrieves the active property name at a specific nesting depth.
   *
   * @param depth The 0-based depth index.
   * @returns The property name, or an empty string if not found.
   */
  getObjectName(depth: number): string {
    return this.#names[depth] ?? "";
  }

  /**
   * Retrieves the property name of the deepest active object context.
   *
   * @returns The current property name, or an empty string if the stack is empty.
   */
  getLast(): string {
    return this.#names[this.#names.length - 1] ?? "";
  }

  /** Pushes a new, empty name context when entering a JSON object. */
  pushObject(): void {
    this.#names.push("");
  }

  /** Pops the deepest name context when exiting a JSON object. */
  popObject(): void {
    this.#names.pop();
  }

  /** Resets the stack and clears all tracked names. */
  reset(): void {
    this.#names.length = 0;
  }

  /**
   * Sets the active property name for the current object context.
   *
   * @param name The parsed object name.
   */
  setLast(name: string): void {
    this.#names[this.#names.length - 1] = name;
  }
}

/** A specialized stack for tracking property-name uniqueness within nested JSON objects. */
class ObjectNamespaceStack {
  #namespaces: Array<Set<string>>;

  /** Creates a new ObjectNamespaceStack instance. */
  constructor() {
    this.#namespaces = [];
  }

  /**
   * Attempts to insert a property name into the current namespace Set.
   *
   * @param name The object name to track.
   * @returns `true` if the name was successfully inserted, or `false` if it already exists (a duplicate).
   */
  insert(name: string): boolean {
    const namespaces = this.#namespaces[this.#namespaces.length - 1];

    if (namespaces.has(name)) {
      return false;
    }

    namespaces.add(name);

    return true;
  }

  /** Pushes a new, empty namespace set when entering a JSON object. */
  pushObject(): void {
    this.#namespaces.push(new Set());
  }

  /** Pops and discards the namespace set when exiting a JSON object. */
  popObject(): void {
    this.#namespaces.pop();
  }

  /** Resets the stack and clears all tracked namespaces. */
  reset(): void {
    this.#namespaces.length = 0;
  }
}

export { ObjectNamespaceStack, ObjectNameStack };
