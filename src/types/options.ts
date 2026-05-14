export type BaseOptions = {
  allowDuplicateNames?: boolean;
  allowInvalidUTF8?: boolean;
};

export type DecoderOptions = BaseOptions;

export type EncoderOptions = {
  escapeForHTML?: boolean;
  escapeForJS?: boolean;
  canonicalizeRawNumbers?: boolean;
  spaceAfterColon?: boolean;
  spaceAfterComma?: boolean;
  multiline?: boolean;
  indent?: string;
  indentPrefix?: string;
} & BaseOptions;
