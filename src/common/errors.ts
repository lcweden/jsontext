import type Pointer from "#src/modules/pointer";

class SyntacticError extends SyntaxError {
  pointer: Pointer;
  offset: number;

  constructor(message: string, pointer: Pointer, offset: number) {
    const within = pointer.toString() ? ` within ${pointer.toString()}` : "";
    const at = ` at offset ${offset}`;

    super(`${message}${within}${at}`);

    this.name = "SyntacticError";
    this.pointer = pointer;
    this.offset = offset;
  }
}

export { SyntacticError };
