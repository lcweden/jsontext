import type { KIND } from "#src/common/constants.ts";

export type Kind = typeof KIND[keyof typeof KIND];
