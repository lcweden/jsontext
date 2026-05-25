/** ASCII byte values used for JSON parsing and encoding. */
const ASCII = {
  TAB: 0x09,
  LINE_FEED: 0x0A,
  CARRIAGE_RETURN: 0x0D,
  SPACE: 0x20,
  QUOTE: 0x22,
  NUMBER_SIGN: 0x23,
  DOLLAR_SIGN: 0x24,
  AMPERSAND: 0x26,
  SINGLE_QUOTE: 0x27,
  ASTERISK: 0x2A,
  PLUS: 0x2B,
  COMMA: 0x2C,
  MINUS: 0x2D,
  DOT: 0x2E,
  DIGIT_0: 0x30,
  DIGIT_1: 0x31,
  DIGIT_2: 0x32,
  DIGIT_3: 0x33,
  DIGIT_4: 0x34,
  DIGIT_5: 0x35,
  DIGIT_6: 0x36,
  DIGIT_7: 0x37,
  DIGIT_8: 0x38,
  DIGIT_9: 0x39,
  COLON: 0x3A,
  OPEN_ANGLED_BRACKET: 0x3C,
  CLOSE_ANGLED_BRACKET: 0x3E,
  AT_SIGN: 0x40,
  UPPER_CASE_A: 0x41,
  UPPER_CASE_E: 0x45,
  UPPER_CASE_Z: 0x5A,
  OPENING_BRACKET: 0x5B,
  BACKSLASH: 0x5C,
  CLOSING_BRACKET: 0x5D,
  UNDERSCORE: 0x5F,
  LOWER_CASE_A: 0x61,
  LOWER_CASE_E: 0x65,
  LOWER_CASE_F: 0x66,
  LOWER_CASE_H: 0x68,
  LOWER_CASE_L: 0x6C,
  LOWER_CASE_N: 0x6E,
  LOWER_CASE_O: 0x6F,
  LOWER_CASE_R: 0x72,
  LOWER_CASE_S: 0x73,
  LOWER_CASE_T: 0x74,
  LOWER_CASE_U: 0x75,
  LOWER_CASE_Z: 0x7A,
  OPENING_BRACE: 0x7B,
  CLOSING_BRACE: 0x7D,
  DELETE: 0x7F,
} as const;

/** Unicode escape sequences for safe HTML and JavaScript embedding. */
const UNICODE = {
  OPEN_ANGLED_BRACKET: "\\u003c",
  CLOSE_ANGLED_BRACKET: "\\u003e",
  AMPERSAND: "\\u0026",
  LINE_SEPARATOR: "\\u2028",
  PARAGRAPH_SEPARATOR: "\\u2029",
} as const;

/** String discriminants identifying the structural role of a JSON token. */
const KIND = {
  NULL: "null",
  FALSE: "false",
  TRUE: "true",
  STRING: "string",
  NUMBER: "number",
  OBJECT_BEGIN: "{",
  OBJECT_END: "}",
  ARRAY_BEGIN: "[",
  ARRAY_END: "]",
} as const;

/** Maximum JSON nesting depth supported by the decoder and encoder. */
const MAX_NESTING_DEPTH = 10_000;

/** Default option values for decoding. */
const DEFAULT_DECODER_OPTIONS = {
  allowDuplicateNames: false,
  allowInvalidUTF8: false,
} as const;

/** Default option values for encoding. */
const DEFAULT_ENCODER_OPTIONS = {
  escapeForHTML: false,
  escapeForJS: false,
  canonicalizeRawNumbers: false,
  spaceAfterColon: true,
  spaceAfterComma: false,
  multiline: true,
  indent: "\t",
  indentPrefix: "",
} as const;

/** JSON Path identifier types. */
const IDENTIFIER = {
  ROOT: 0,
  CURRENT: 1,
} as const;

/** JSON Path segment kinds. */
const SEGMENT = {
  CHILD: 0,
  DESCENDANT: 1,
} as const;

/** JSON Path selector kinds. */
const SELECTOR = {
  NAME: 0,
  WILDCARD: 1,
  INDEX: 2,
  ARRAY_SLICE: 3,
} as const;

export {
  ASCII,
  DEFAULT_DECODER_OPTIONS,
  DEFAULT_ENCODER_OPTIONS,
  IDENTIFIER,
  KIND,
  MAX_NESTING_DEPTH,
  SEGMENT,
  SELECTOR,
  UNICODE,
};
