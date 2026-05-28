# JSONText

[![license](https://img.shields.io/github/license/lcweden/jsontext.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/jsontext.svg)](https://www.npmjs.com/package/jsontext)
[![jsr version](https://img.shields.io/jsr/v/@lcweden/jsontext)](https://jsr.io/@lcweden/jsontext)

A state machine for incremental JSON processing.

## Quick Start

The following example demonstrates how to use `JSONTextSelectorStream` to extract all `address` from
a JSON fetched from [DummyJSON](https://dummyjson.com/).

```javascript
import { JSONTextSelectorStream } from "jsontext";

const response = await fetch("https://dummyjson.com/users");
const addresses = response.body.pipeThrough(new JSONTextSelectorStream("$.users[*].address"));

for await (const value of addresses) {
  console.log(value.json());
}
```

## Installation

`jsontext` is an ESM-only package available on both `NPM` and `JSR`. The core decoder and encoder
run in any modern JavaScript environment; the optional `*Stream` classes additionally require
`WHATWG` Streams support:

### NPM

Install via [npm](https://www.npmjs.com/package/jsontext):

```bash
npm install jsontext
```

### Deno

Install via [JSR](https://jsr.io/@lcweden/jsontext):

```bash
deno add jsr:@lcweden/jsontext
```

## APIs

See full reference on [JSR](https://jsr.io/@lcweden/jsontext/doc/).

| Category   | Exports                                                                                                  |
| :--------- | :------------------------------------------------------------------------------------------------------- |
| Core       | [`JSONTextDecoder`], [`JSONTextEncoder`]                                                                 |
| Stream     | [`JSONTextDecoderStream`], [`JSONTextEncoderStream`], [`JSONTextSelectorStream`], [`JSONTextLineStream`] |
| Components | [`Token`], [`Value`], [`Kind`]                                                                           |
| Error      | [`SyntacticError`]                                                                                       |

[`JSONTextDecoder`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextDecoder
[`JSONTextEncoder`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextEncoder
[`JSONTextDecoderStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextDecoderStream
[`JSONTextEncoderStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextEncoderStream
[`JSONTextSelectorStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextSelectorStream
[`JSONTextLineStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextLineStream
[`Token`]: https://jsr.io/@lcweden/jsontext/doc/~/Token
[`Value`]: https://jsr.io/@lcweden/jsontext/doc/~/Value
[`Kind`]: https://jsr.io/@lcweden/jsontext/doc/~/KIND
[`SyntacticError`]: https://jsr.io/@lcweden/jsontext/doc/~/SyntacticError

### Core

The core APIs provide more control and flexibility. They are designed for scenarios where Web
Streams are not available or when you need granular control.

#### JSONTextDecoder

A low-level, stateful JSON decoder that processes bytes incrementally. It is suitable for developing
custom JSON processing logic and `TransformStreams`.

Unlike `JSON.parse`, you need to `.push()` bytes into `JSONTextDecoder` as they arrive, and pull
`Tokens` or `Values`.

##### Basic Usage

The following example demonstrates how to `.push()` bytes into `JSONTextDecoder` and read tokens one
by one. The decoder automatically buffers incomplete tokens across bytes.

```javascript
const decoder = new JSONTextDecoder();

decoder.push(new TextEncoder().encode(`{"name": "Al`));
decoder.push(new TextEncoder().encode(`ice", "age": 18`));
decoder.push(new TextEncoder().encode(`}`));

decoder.end(); // no more bytes are coming, signal the end of input

decoder.readToken().kind; // KIND.OBJECT_BEGIN  ('{')
decoder.readToken().asString(); // "name"
decoder.readToken().asString(); // "Alice"
decoder.readToken().asString(); // "age"
decoder.readToken().asNumber(); // 18
decoder.readToken().kind; // KIND.OBJECT_END    ('}')

decoder.checkEOF();
```

You may want to check the type before parsing a `Token`. `KIND` is a constant enum that can be used
like this: `token.kind === KIND.STRING` or `token.kind === KIND.BOOLEAN`.

> [!TIP]
> `.end()` signals that no more bytes will be pushed. The decoder needs this signal to confirm that
> a number at the very end of the stream is complete and not just more digits still coming, since
> there is no delimiter after it. Always call `.end()` when you know the input is done.

> [!TIP]
> `checkEOF()` asserts that the entire input was consumed and well-formed, no unclosed objects or
> trailing garbage bytes.

##### Extracting and Skipping Values

Other than reading tokens one by one, you can also read a `Value` with `.readValue()`, which can be
a scalar, an entire object, or an array.

```javascript
const decoder = new JSONTextDecoder(new TextEncoder().encode(`{"id": 1, "metadata": {  }}`));
let token;

while (true) {
  token = decoder.readToken();

  if (token === undefined) {
    break; // need more bytes
  }

  if (token.asString() === "metadata") {
    const value = decoder.readValue();
    const metadata = value.json();
  } else {
    decoder.skipValue(); // skip the value of this token without parsing it
  }
}

decoder.end();
decoder.checkEOF();
```

The example above follows the sequence:

| step | action                      |
| :--- | :-------------------------- |
| 1    | read a token (`"id"`)       |
| 2    | skip the value (`1`)        |
| 3    | read a token (`"metadata"`) |
| 4    | read a value (`{ }`)        |
| 5    | parse the value as JSON     |

> [!TIP]
> Use `.stackPointer()` to get the [JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901),
> which is useful for targeting specific paths in the document like
> `decoder.stackPointer() === "/metadata"`.

##### Web Streams

The following example demonstrates how to use `JSONTextDecoder` with a `ReadableStream` from
`fetch`.

```javascript
const response = await fetch("your.api/endpoint");
const decoder = new JSONTextDecoder();

// Outer loop: wait for new chunks to arrive
for await (const chunk of response.body) {
  decoder.push(chunk);

  // Inner loop: read all decodable tokens from the current buffer
  for (let token; (token = decoder.readToken()) !== undefined;) {
    // read token or value...
  }
}

decoder.end();
decoder.checkEOF();
```

Requires the user to manage backpressure and chunk boundaries, it gives you the most control and
flexibility. Check `JSONTextDecoderStream` to see how to wrap it in a `TransformStream` that handles
all the stream mechanics for you.

#### JSONTextEncoder

It is the exact counterpart to `JSONTextDecoder`, which allows you to construct a JSON document
token by token or value.

##### Basic Usage

You can feel free to write tokens and values in any order using `Token` and `Value` provided
methods.

```javascript
import { Token, Value } from "jsontext";

const decoder = new TextDecoder();
const encoder = new JSONTextEncoder();

encoder.writeToken(Token.ARRAY_BEGIN);
encoder.writeValue(Value.from({ id: 1, status: "active" }));
encoder.writeValue(Value.from({ id: 2, status: "pending" }));
encoder.writeToken(Token.ARRAY_END);

const bytes = encoder.takeBytes();
const text = decoder.decode(bytes);
// '[{"id":1,"status":"active"},{"id":2,"status":"pending"}]'
```

##### Round Trip

A common use case is piping a decoder directly into an encoder to mutate a stream on the fly. In
this pattern, you drain tokens from the decoder, modify them if needed, and write them to the
encoder.

```javascript
const decoder = new JSONTextDecoder();
const encoder = new JSONTextEncoder();

const response = await fetch("your.api/endpoint");

for await (const chunk of response.body) {
  decoder.push(chunk);

  for (let token; (token = decoder.readToken()) !== undefined;) {
    encoder.writeToken(token);
  }

  const bytes = encoder.takeBytes();
}

decoder.end();
decoder.checkEOF();
```

> [!IMPORTANT]
> `takeBytes()` only gives you the encoded bytes and clears the encoder's internal buffer. It does
> not write them anywhere. You must manually pipe these bytes to your destination, such as a file
> writer, network socket, or controller.

### Stream

These classes wrap the core decoder and encoder in `TransformStream` interfaces, making them easy to
handle some common use cases and compose with other Web Streams APIs. See the [Examples](#examples)
section for more details.

#### JSONTextDecoderStream

Wraps a `JSONTextDecoder` and emits `Token`s as they are decoded. Ideal for token-level processing,
such as filtering or transforming tokens. If you need to work with `Value`, use `JSONTextDecoder`
directly.

```javascript
const response = await fetch("your.api/endpoint");
const tokens = response.body.pipeThrough(new JSONTextDecoderStream());

for await (const token of tokens) {
  // ...
}
```

#### JSONTextEncoderStream

Wraps a `JSONTextEncoder` and accepts `Token` only. While streams like `JSONTextSelectorStream` and
`JSONTextLineStream` emit `Value`, `Value` provides a `.tokens()` generator that can be used to feed
tokens into `JSONTextEncoderStream`.

The following example demonstrates how to write a `TransformStream` that converts `Value` into
`Token` and pipe it into a `JSONTextEncoderStream`.

```javascript
const encoder = new JSONTextEncoderStream();
const transformer = new TransformStream({
  transform(value, controller) {
    for (const token of value.tokens()) {
      controller.enqueue(token);
    }
  },
});

stream.pipeThrough(transformer).pipeThrough(encoder);
```

#### JSONTextSelectorStream

`JSONTextSelectorStream` supports a subset of
[JSON Path](https://datatracker.ietf.org/doc/html/rfc9535) syntax for selecting specific values from
a JSON document.

| Supported                                                                                       | Syntax                                  |
| :---------------------------------------------------------------------------------------------- | :-------------------------------------- |
| [Root Identifier](https://datatracker.ietf.org/doc/html/rfc9535#name-root-identifier)           | `$`                                     |
| [Child Segment](https://datatracker.ietf.org/doc/html/rfc9535#name-child-segment)               | `.`, `[]`                               |
| [Descendant Segment](https://datatracker.ietf.org/doc/html/rfc9535#name-descendant-segment)     | `..`                                    |
| [Name Selector](https://datatracker.ietf.org/doc/html/rfc9535#name-name-selector)               | `.name`, `['name']`, `['name', 'name']` |
| [Wildcard Selector](https://datatracker.ietf.org/doc/html/rfc9535#name-wildcard-selector)       | `.*`                                    |
| [Index Selector](https://datatracker.ietf.org/doc/html/rfc9535#name-index-selector)             | `[0]`                                   |
| [Array Slice Selector](https://datatracker.ietf.org/doc/html/rfc9535#name-array-slice-selector) | `[start:end:step]`                      |

> [!NOTE]
> Negative numbers in index and slice selectors are not supported.

The following example extracts all `email` values from `{ "users": [ ... ] }`.

```javascript
const response = await fetch("your.api/endpoint");
const emails = response.body.pipeThrough(new JSONTextSelectorStream("$.users[*].email"));

for await (const value of emails) {
  console.log(value.json());
}
```

> [!TIP]
> `Value` has an optional `.pointer` property that returns the
> [JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) of where the value was located in
> the source document. `JSONTextSelectorStream` sets this automatically, so you can use it to get
> the exact location of each selected value.

#### JSONTextLineStream

`JSONTextLineStream` is designed for processing JSON Lines (JSONL) format, but it can also handle
concatenated JSON documents.

```javascript
const response = await fetch("your.api/endpoint");
const lines = response.body.pipeThrough(new JSONTextLineStream());

for await (const value of lines) {
  console.log(value.json());
}
```

### Components

#### Token

A `Token` represents the smallest lexical unit of JSON. It is either a scalar (like `"Alice"`,
`true`, `123`, `null`) or a structural symbol (like `{`, `}`, `[`, `]`), it **never** represents a
whole object or array.

See JSR documentation for all available methods, such as `ARRAY_BEGIN`, `.asNumber()`,
`.isScalar()`, etc.

> [!IMPORTANT]
> Tokens and Values returned from a decoder are views into its internal buffer. This buffer is
> overwritten the next time you `.push()` more bytes.
>
> If you need to keep a token or value around for later use, you must copy it using `.clone()`:
>
> ```javascript
> const collected = [];
> while ((token = decoder.readToken()) !== undefined) {
>   collected.push(token); // ❌ UNSAFE: all entries will point to the mutated bytes
>   collected.push(token.clone()); // ✅ SAFE: creates an independent copy
> }
> ```

#### Value

A `Value` represents a complete JSON unit. It can be a simple scalar, or it can be an entire
`object` or `array` including everything nested inside it.

Use `Value` when you need a specific subtree. You can call `value.json()` to materialize it into a
JavaScript object, or use `decoder.skipValue()` to cheaply discard massive branches you don't need
without ever parsing them.

##### Create a Value instance `from`

`.from()` is a static helper that creates a `Value` instance from any JSON-serializable value.

```javascript
const value = Value.from("Hello, World!");
```

##### Canonicalize

`.canonicalize()` implements the
[JSON Canonicalization Scheme](https://datatracker.ietf.org/doc/html/rfc8785) by recursively sorting
object keys by UTF-16 code unit order and normalizing numbers. The result is deterministic and
idempotent, making it ideal for hashing or strict comparisons.

```javascript
const value = Value.from({ b: 2, a: 1 }).canonicalize(); // {"a":1,"b":2}
```

##### Tokenize

`.tokens()` is a generator method that yields each `Token` within this value in document order. This
allows you to process or transform the value token by token without materializing the whole thing in
memory.

```javascript
const value = Value.from({ name: "Alice", tags: ["admin", "user"] });

for (const token of value.tokens()) {
  if (token.kind === KIND.STRING) {
    console.log(token.asString());
  }
}
```

#### Kind

`KIND` is a constant object containing string discriminants that identify the structural role of a
JSON token. Always use these constants for comparisons to avoid typos.

| Kind                | Value      |
| :------------------ | :--------- |
| `KIND.NULL`         | `"null"`   |
| `KIND.FALSE`        | `"false"`  |
| `KIND.TRUE`         | `"true"`   |
| `KIND.STRING`       | `"string"` |
| `KIND.NUMBER`       | `"number"` |
| `KIND.OBJECT_BEGIN` | `"{"`      |
| `KIND.OBJECT_END`   | `"}"`      |
| `KIND.ARRAY_BEGIN`  | `"["`      |
| `KIND.ARRAY_END`    | `"]"`      |

You can check a token's kind with `token.kind === KIND.STRING` or use helper methods like
`token.isScalar()`, `token.isStructural()`, etc.

### Error

`jsontext` throws standard JavaScript errors (`TypeError`, `RangeError`, `SyntaxError`) for
programmer mistakes such as invalid arguments or type mismatches. For malformed JSON input, it
throws the custom `SyntacticError` described below.

#### SyntacticError

When input violates [The JavaScript Object Notation](https://datatracker.ietf.org/doc/html/rfc8259),
it throws a `SyntacticError` carrying both the byte `offset` and the JSON `pointer` to help pinpoint
the exact failure.

```javascript
import { JSONTextDecoder, SyntacticError } from "jsontext";

try {
  const encoder = new TextEncoder();
  const decoder = new JSONTextDecoder(encoder.encode(`{"a": 1, "b": }`));

  decoder.end();

  while (decoder.readToken() !== undefined) {
    /* ... */
  }
} catch (error) {
  if (error instanceof SyntacticError) {
    console.error(error.offset);
    console.error(error.pointer);
    console.error(error.message);
  }
}
```

## Performance

`jsontext` is designed for flat memory usage regardless of input size. The following shows a
passthrough run on a 1 GB file — heap stays near baseline throughout:

![Passthrough Result](https://github.com/user-attachments/assets/6d8d795b-ba11-41c1-8993-ac5e15088524)

For full profiling results across passthrough, round-trip, and query scenarios, see
[docs/performance.md](docs/performance.md).

## Examples

Below are some simple examples demonstrating how to use `jsontext` for common JSON processing tasks.
For more examples, see the [docs/](docs/).

### Replace `null` with an empty string

In this example, we read a JSON stream from an API endpoint, replace all `null` values with empty
strings, and write the modified JSON back out as a stream without ever materializing the whole
document in memory.

```javascript
import { JSONTextDecoderStream, JSONTextEncoderStream, KIND, Token } from "jsontext";

const response = await fetch("your.api/endpoint");

if (!response.ok || !response.body) {
  throw new Error("Failed to fetch data");
}

const decoder = new JSONTextDecoderStream();
const encoder = new JSONTextEncoderStream();
const replacer = new TransformStream({
  transform(token, controller) {
    if (token.kind === KIND.NULL) { // Detect a `null` token
      controller.enqueue(Token.fromString("")); // Emit an empty string token instead
    } else {
      controller.enqueue(token);
    }
  },
});

const stream = response.body.pipeThrough(decoder).pipeThrough(replacer).pipeThrough(encoder);
const blob = await new Response(stream).blob();
```

> [!TIP]
> `JSONTextDecoderStream` supports token-level processing only. If you need to replace values that
> may be nested inside objects or arrays, you will need to use `JSONTextDecoder` directly.

## License

This project is licensed under the [MIT](LICENSE) License.

## Acknowledgements

This project is inspired by Go's
[`encoding/json/jsontext`](https://pkg.go.dev/encoding/json/jsontext) standard library.
