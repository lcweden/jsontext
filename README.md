# JSONText

A streaming JSON parser and serializer for JavaScript, operating at the syntactic layer — processing
JSON tokens and values without any semantic marshaling.

## Quick Start

Parse a JSON stream and extract specific values with a JSONPath query:

```ts
import { JSONTextSelectorStream } from "jsontext";

const response = await fetch("https://example.com/data.json");
const stream = response.body.pipeThrough(new JSONTextSelectorStream("$.items[*]"));

for await (const value of stream) {
  console.log(value.json());
}
```

## Installation

### NPM

```bash
npm install jsontext
```

## APIs

### JSONTextDecoderStream

Transforms a `ReadableStream<Uint8Array>` into a `ReadableStream<Token>`, emitting one `Token` per
JSON token in document order.

```ts
import { JSONTextDecoderStream } from "jsontext";

const response = await fetch("https://example.com/data.json");

for await (const token of response.body.pipeThrough(new JSONTextDecoderStream())) {
  console.log(token.kind, token.bytes);
}
```

### JSONTextEncoderStream

Transforms a `ReadableStream<Token>` into a `ReadableStream<Uint8Array>`.

```ts
import { JSONTextEncoderStream, Token } from "jsontext";

const { readable, writable } = new JSONTextEncoderStream();
const writer = writable.getWriter();

writer.write(Token.ARRAY_BEGIN);
writer.write(Token.fromNumber(1));
writer.write(Token.fromNumber(2));
writer.write(Token.fromNumber(3));
writer.write(Token.ARRAY_END);
writer.close();

const bytes = await new Response(readable).arrayBuffer();
```

### JSONTextSelectorStream

Transforms a byte stream into a `ReadableStream<Value>`, emitting only values matched by a
[JSON Path](https://www.rfc-editor.org/rfc/rfc9535) query.

```ts
import { JSONTextSelectorStream } from "jsontext";

const response = await fetch("https://example.com/data.json");
const stream = response.body.pipeThrough(new JSONTextSelectorStream("$.features[*].geometry"));

for await (const value of stream) {
  console.log(value.json());
}
```

Supports the following [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535) selectors: Child Segment,
Descendant Segment, Name Selector, Wildcard Selector, Index Selector (positive only), and Array
Slice Selector (positive only).

### JSONTextLineStream

Transforms a byte stream into a `ReadableStream<Value>`, emitting one complete `Value` per top-level
JSON value. Well-suited for JSONL / JSON Lines and other concatenated-JSON streams.

```ts
import { JSONTextLineStream } from "jsontext";

const response = await fetch("https://example.com/data.jsonl");
const stream = response.body.pipeThrough(new JSONTextLineStream());

for await (const value of stream) {
  console.log(value.json());
}
```

## Types

### Kind

`Kind` is a string literal type representing the class of a JSON token. All values are available on
the `KIND` constant:

```ts
import { KIND } from "jsontext";

KIND.NULL; // "null"
KIND.TRUE; // "true"
KIND.FALSE; // "false"
KIND.STRING; // "string"
KIND.NUMBER; // "number"
KIND.OBJECT_BEGIN; // "{"
KIND.OBJECT_END; // "}"
KIND.ARRAY_BEGIN; // "["
KIND.ARRAY_END; // "]"
```

### Token

A `Token` represents a single lexical element — a scalar value (`null`, `true`, `false`, a number,
or a string) or a structural delimiter (`{`, `}`, `[`, `]`).

**Pre-built tokens:**

```ts
Token.NULL; // null
Token.TRUE; // true
Token.FALSE; // false
Token.OBJECT_BEGIN; // {
Token.OBJECT_END; // }
Token.ARRAY_BEGIN; // [
Token.ARRAY_END; // ]
```

**Factory methods:**

```ts
Token.fromBoolean(true); // true
Token.fromNumber(3.14); // 3.14
Token.fromString("hello"); // "hello"
Token.fromText('"raw"'); // from a raw JSON text string
```

### Value

A `Value` represents a complete JSON value — a scalar or an entire object/array including all nested
content.

**Factory methods:**

```ts
Value.from({ name: "Alice", scores: [1, 2, 3] });
// {"name":"Alice","scores":[1,2,3]}
```

## Examples

The following examples demonstrate how to use the streaming API to perform common transformations on
JSON data.

### Redacting values

```javascript
import { JSONTextDecoderStream, JSONTextEncoderStream } from "jsontext";

const target = "password";
const response = await fetch("https://example.com/user.json");

response.body
  .pipeThrough(new JSONTextDecoderStream())
  .pipeThrough(
    new TransformStream({
      transform(token, controller) {
        if (token.kind === KIND.STRING && token.asString() === target) {
          controller.enqueue(Token.fromString("********"));
        } else {
          controller.enqueue(token);
        }
      },
    }),
  )
  .pipeThrough(new JSONTextEncoderStream());
```

### Extracting into a new array

```javascript
import { JSONTextEncoderStream, JSONTextSelectorStream } from "jsontext";

const response = await fetch("https://example.com/data.json");

response.body
  .pipeThrough(new JSONTextSelectorStream("$.items[*]"))
  .pipeThrough(
    new TransformStream({
      start(controller) {
        controller.enqueue(Token.ARRAY_BEGIN);
      },
      transform(value, controller) {
        for (const token of value.tokens()) {
          controller.enqueue(token);
        }
      },
      flush(controller) {
        controller.enqueue(Token.ARRAY_END);
      },
    }),
  )
  .pipeThrough(new JSONTextEncoderStream());
```

## Core

For cases where the stream API is not flexible enough, `JSONTextDecoder` and `JSONTextEncoder`
provide a lower-level interface for building custom decoders and encoders.

### JSONTextDecoder

```ts
import { JSONTextDecoder } from "jsontext";

const decoder = new JSONTextDecoder();
decoder.push(new TextEncoder().encode('{"name":"Alice"}'));
decoder.end();

let token;
while ((token = decoder.readToken()) !== undefined) {
  console.log(token.kind);
}

decoder.checkEOF(); // throws if there are unconsumed bytes or an incomplete value
```

| Method                 | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `push(bytes)`          | Append a chunk of raw JSON bytes                                                     |
| `end()`                | Signal end-of-input; validates the stream is not mid-value                           |
| `readToken()`          | Return the next `Token`, or `undefined` if more input is needed                      |
| `readValue()`          | Return the next complete `Value`, or `undefined` if more input is needed             |
| `skipValue()`          | Discard the next complete value; returns `true` if a value was skipped               |
| `peekKind()`           | Inspect the next token kind without consuming it                                     |
| `stackPointer(where?)` | JSON Pointer to the next (`1`), current container (`0`), or previous (`-1`) position |
| `inputOffset()`        | Byte offset of the next unread byte                                                  |
| `depth()`              | Current nesting depth                                                                |
| `unreadBytes()`        | View of buffered but unconsumed bytes                                                |
| `checkEOF()`           | Assert that all input has been consumed                                              |
| `reset()`              | Clear all buffered input and internal state                                          |

### JSONTextEncoder

```ts
import { JSONTextEncoder, Token } from "jsontext";

const encoder = new JSONTextEncoder();
encoder.writeToken(Token.OBJECT_BEGIN);
encoder.writeToken(Token.fromString("name"));
encoder.writeToken(Token.fromString("Alice"));
encoder.writeToken(Token.OBJECT_END);

console.log(new TextDecoder().decode(encoder.bytes()));
```

| Method                 | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `writeToken(token)`    | Encode a `Token` and append its bytes to the output buffer                           |
| `writeValue(value)`    | Encode a `Value` and append its bytes to the output buffer                           |
| `bytes()`              | All bytes produced so far                                                            |
| `outputOffset()`       | Byte offset after the last written token                                             |
| `stackPointer(where?)` | JSON Pointer to the next (`1`), current container (`0`), or previous (`-1`) position |
| `depth()`              | Current nesting depth                                                                |
| `reset()`              | Clear the output buffer and all internal state                                       |

## Options

### Decoder

| Option                | Default | Description                                                   |
| --------------------- | ------- | ------------------------------------------------------------- |
| `allowDuplicateNames` | `false` | Allow duplicate object member names                           |
| `allowInvalidUTF8`    | `false` | Replace invalid UTF-8 bytes with `U+FFFD` instead of erroring |

### Encoder

All decoder options, plus:

| Option                   | Default | Description                                                  |
| ------------------------ | ------- | ------------------------------------------------------------ |
| `escapeForHTML`          | `false` | Escape `<`, `>`, `&` as `\uXXXX` for safe HTML embedding     |
| `escapeForJS`            | `false` | Escape `U+2028` and `U+2029` for safe JavaScript embedding   |
| `canonicalizeRawNumbers` | `false` | Normalize numbers per RFC 8785 §3.2.2.3                      |
| `spaceAfterColon`        | `true`  | Emit a space after `:` in objects                            |
| `spaceAfterComma`        | `false` | Emit a space after `,`                                       |
| `multiline`              | `true`  | Expand output across multiple indented lines                 |
| `indent`                 | `"\t"`  | Indentation string (implies `multiline`)                     |
| `indentPrefix`           | `""`    | Prefix prepended to each indented line (implies `multiline`) |

## Acknowledgements

This project is heavily inspired by Go's
[`encoding/json/jsontext`](https://pkg.go.dev/encoding/json/jsontext) standard library. The API and
internal design are closely modeled after it, with adjustments made to fit JavaScript's language
features and ecosystem.
