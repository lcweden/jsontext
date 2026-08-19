import { KIND } from "#src/common/constants";

/**
 * String discriminants identifying the kind of a JSON token.
 *
 * @public
 */
export const Kind: {
  readonly NULL: "null";
  readonly FALSE: "false";
  readonly TRUE: "true";
  readonly STRING: "string";
  readonly NUMBER: "number";
  readonly OBJECT_BEGIN: "{";
  readonly OBJECT_END: "}";
  readonly ARRAY_BEGIN: "[";
  readonly ARRAY_END: "]";
} = KIND;

/**
 * A union of the string values used to identify JSON token kinds.
 *
 * @public
 */
export type Kind = typeof Kind[keyof typeof Kind];
