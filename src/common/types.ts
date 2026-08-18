import type { KIND } from "#src/common/constants";

/**
 * A union type of all possible JSON token kind values, corresponding to the
 * string discriminants in {@link KIND}.
 *
 * @internal
 */
export type Kind = typeof KIND[keyof typeof KIND];
