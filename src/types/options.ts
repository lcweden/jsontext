/**
 * Base options for {@link DecoderOptions} and {@link EncoderOptions}.
 *
 * @internal
 */
export type BaseOptions = {
  /** Allow duplicate object key names. By default, duplicate names throw a `SyntacticError`. */
  allowDuplicateNames?: boolean;
  /** Allow invalid UTF-8 byte sequences. By default, invalid sequences throw a `TypeError`. */
  allowInvalidUTF8?: boolean;
};

/**
 * Options for {@link Decoder}.
 *
 * @internal
 */
export type DecoderOptions = BaseOptions;

/**
 * Options for {@link Encoder}.
 *
 * @internal
 */
export type EncoderOptions = {
  /** Escape `<`, `>`, and `&` for safe embedding in HTML. */
  escapeForHTML?: boolean;
  /** Escape `\u2028` and `\u2029` for safe embedding in JavaScript string literals. */
  escapeForJS?: boolean;
  /** Normalize number tokens to their canonical decimal form. */
  canonicalizeRawNumbers?: boolean;
  /** Emit a space after each `:` separator in objects. */
  spaceAfterColon?: boolean;
  /** Emit a space after each `,` separator in arrays and objects. */
  spaceAfterComma?: boolean;
  /** Emit each value on its own line with indentation. */
  multiline?: boolean;
  /** Indentation string used per nesting level when multiline is enabled. Defaults to two spaces. */
  indent?: string;
  /** Prefix prepended to every indented line when multiline is enabled. */
  indentPrefix?: string;
} & BaseOptions;
