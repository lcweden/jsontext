/**
 * A specialized stack for tracking the current property names of nested JSON objects.
 *
 * @internal
 */
class ObjectNameStack {
  #names: Array<string>;

  /**
   * Creates a new ObjectNameStack instance.
   */
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
   * Retrieves the property name of the deepest (currently active) object context.
   *
   * @returns The current property name, or an empty string if the stack is empty.
   */
  getLast(): string {
    return this.#names[this.#names.length - 1] ?? "";
  }

  /**
   * Pushes a new, empty name context onto the stack when entering a new JSON object.
   */
  pushObject(): void {
    this.#names.push("");
  }

  /**
   * Pops the deepest name context from the stack when exiting a JSON object.
   */
  popObject(): void {
    this.#names.pop();
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

/**
 * A specialized stack for tracking the uniqueness of property names within nested JSON objects.
 *
 * @internal
 */
class ObjectNamespaceStack {
  #namespaces: Array<Set<string>>;

  /**
   *  Creates a new ObjectNamespaceStack instance.
   */
  constructor() {
    this.#namespaces = [];
  }

  /**
   * Pushes a new, empty namespace Set when entering a new JSON object.
   */
  pushObject(): void {
    this.#namespaces.push(new Set());
  }

  /**
   * Pops and discards the namespace Set when exiting a JSON object.
   */
  popObject(): void {
    this.#namespaces.pop();
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
}

export { ObjectNamespaceStack, ObjectNameStack };
