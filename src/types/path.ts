import type { SEGMENT, SELECTOR } from "#src/common/constants";

export type Selector =
  | { type: typeof SELECTOR.NAME; value: string }
  | { type: typeof SELECTOR.WILDCARD }
  | { type: typeof SELECTOR.INDEX; value: number }
  | { type: typeof SELECTOR.ARRAY_SLICE; start?: number; end?: number; step?: number };

export type Segment =
  | { type: typeof SEGMENT.CHILD; selectors: Selector[] }
  | { type: typeof SEGMENT.DESCENDANT; selectors: Selector[] };
