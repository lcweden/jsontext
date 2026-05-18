class SyntacticError extends SyntaxError {
  pointer: string;
  offset: number;

  constructor(message: string, pointer: string, offset: number) {
    const within = pointer ? ` within ${pointer}` : "";
    const at = ` at offset ${offset}`;

    super(`${message}${within}${at}`);

    this.name = "SyntacticError";
    this.pointer = pointer;
    this.offset = offset;
  }
}

export { SyntacticError };
