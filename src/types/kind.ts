import type { KIND } from "#src/common/constants";

export type Kind = typeof KIND[keyof typeof KIND];
