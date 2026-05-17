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
  UPPER_CASE_A: 0x41,
  UPPER_CASE_E: 0x45,
  UPPER_CASE_Z: 0x5A,
  OPENING_BRACKET: 0x5B,
  BACKSLASH: 0x5C,
  CLOSING_BRACKET: 0x5D,
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

const UNICODE = {
  OPEN_ANGLED_BRACKET: "\\u003c",
  CLOSE_ANGLED_BRACKET: "\\u003e",
  AMPERSAND: "\\u0026",
  LINE_SEPARATOR: "\\u2028",
  PARAGRAPH_SEPARATOR: "\\u2029",
};

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

const MAX_NESTING_DEPTH = 10000;

const DEFAULT_DECODER_OPTIONS = {
  allowDuplicateNames: false,
  allowInvalidUTF8: false,
} as const;

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

const SELECTOR = {
  NAME: "NAME",
  WILDCARD: "WILDCARD",
  INDEX: "INDEX",
  ARRAY_SLICE: "ARRAY_SLICE",
} as const;

const SEGMENT = {
  CHILD: "CHILD",
  DESCENDANT: "DESCENDANT",
} as const;

export {
  ASCII,
  DEFAULT_DECODER_OPTIONS,
  DEFAULT_ENCODER_OPTIONS,
  KIND,
  MAX_NESTING_DEPTH,
  SEGMENT,
  SELECTOR,
  UNICODE,
};
