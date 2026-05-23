import { IDENTIFIER, SEGMENT, SELECTOR } from "#src/common/constants";

export type NameSelector = { type: typeof SELECTOR.NAME; name: string };

export type WildcardSelector = { type: typeof SELECTOR.WILDCARD };

export type IndexSelector = { type: typeof SELECTOR.INDEX; index: number };

export type ArraySliceSelector = {
  type: typeof SELECTOR.ARRAY_SLICE;
  start?: number;
  end?: number;
  step?: number;
};

export type Identifier = typeof IDENTIFIER[keyof typeof IDENTIFIER];

export type Selector =
  | NameSelector
  | WildcardSelector
  | IndexSelector
  | ArraySliceSelector;

export type Segment = {
  type: typeof SEGMENT[keyof typeof SEGMENT];
  selectors: Selector[];
};
