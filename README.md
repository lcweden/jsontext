# JSONText

A state machine for incremental JSON processing.

## Quick Start

The following example demonstrates how to use `JSONTextSelectorStream` to extract all `title` values
from a JSON stream fetched from [DummyJSON](https://dummyjson.com/).

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

| Category  | Exports                                                                                                  |
| :-------- | :------------------------------------------------------------------------------------------------------- |
| Core      | [`JSONTextDecoder`], [`JSONTextEncoder`]                                                                 |
| Stream    | [`JSONTextDecoderStream`], [`JSONTextEncoderStream`], [`JSONTextSelectorStream`], [`JSONTextLineStream`] |
| Component | [`Token`], [`Value`], [`KIND`]                                                                           |
| Error     | [`SyntacticError`]                                                                                       |

[`JSONTextDecoder`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextDecoder
[`JSONTextEncoder`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextEncoder
[`JSONTextDecoderStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextDecoderStream
[`JSONTextEncoderStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextEncoderStream
[`JSONTextSelectorStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextSelectorStream
[`JSONTextLineStream`]: https://jsr.io/@lcweden/jsontext/doc/~/JSONTextLineStream
[`Token`]: https://jsr.io/@lcweden/jsontext/doc/~/Token
[`Value`]: https://jsr.io/@lcweden/jsontext/doc/~/Value
[`KIND`]: https://jsr.io/@lcweden/jsontext/doc/~/KIND
[`SyntacticError`]: https://jsr.io/@lcweden/jsontext/doc/~/SyntacticError

## Concepts

`JSON.parse` is a native, single-pass parser. It will always be faster than `jsontext` on JSON that
fits comfortably in memory.

`jsontext` makes a deliberate tradeoff: it gives up raw throughput to gain bounded memory, lower
time to first result, incremental processing, and the ability to filter data without ever
materializing it. This matters when the input is too large to hold, arrives in chunks, or you only
care about a small slice of it.

```javascript
// JSON.parse — needs the whole string, builds the whole tree
const data = await response.json(); // JSON.parse(await response.text());
const titles = data.map((item) => item.title);

// jsontext — reads bytes as they arrive, emits values one by one
const titles = response.body.pipeThrough(new JSONTextSelectorStream("$..title"));

for await (const value of titles) {
  console.log(value.json());
}
```

### Tokens and Values

Represents JSON at two granularities:

- **Tokens**: The smallest lexical unit (a scalar like `"Alice"`, `true`, `123`, or a structural
  symbol like `{`, `}`, `[`, `]`).

- **Values**: A complete unit — a scalar, or an entire `object` or `array` including everything
  nested inside.

A token can never represent a whole object or array; a value always can.

```javascript
import { JSONTextDecoder, KIND } from "jsontext";

const json = `{"name": "Alice", "tags": ["admin", "user"]}`;
const decoder = new JSONTextDecoder(new TextEncoder().encode(json));
decoder.end(); // signal no more bytes will be pushed

// readToken — one lexical step at a time
decoder.readToken().kind; // KIND.OBJECT_BEGIN  ('{')
decoder.readToken().asString(); // "name"
decoder.readToken().asString(); // "Alice"
decoder.readToken().asString(); // "tags"

// readValue — collapses an entire subtree into one Value
const tags = decoder.readValue();
tags.json(); // ["admin", "user"]

decoder.readToken().kind; // KIND.OBJECT_END    ('}')
```

Use `Value` when you need a specific subtree. Call `value.json()` to materialize it, or
`decoder.skipValue()` to cheaply discard massive branches you don't need without parsing them.

> [!IMPORTANT]
> Tokens and values returned from a decoder are views into its internal buffer. The buffer is
> overwritten the next time you `.push()` more bytes or read another token/value, so anything you
> keep around must be copied first with `.clone()`.
>
> ```javascript
> const collected = [];
> let token;
>
> while ((token = decoder.readToken()) !== undefined) {
>   collected.push(token); // unsafe: all entries may end up pointing at the same bytes
>   collected.push(token.clone()); // safe: independent copy
> }
> ```

### Push and pull

Decoding is split into two halves. You **push** bytes in whenever you have them — from a single
buffer, a stream chunk, a socket, anything — and you **pull** tokens or values out at your own pace.
The decoder buffers what it needs and waits for more bytes when a token straddles a chunk boundary.

This decoupling is what makes _time to first result_ low. With `JSON.parse` you must wait for the
entire payload before you can touch any data; if the server takes 5 seconds to stream a 50 MB
response, you wait 5 seconds. With `jsontext` the first token is available as soon as the first few
bytes arrive — typically tens of milliseconds.

```javascript
import { JSONTextDecoder } from "jsontext";

const decoder = new JSONTextDecoder();

for await (const chunk of response.body) {
  decoder.push(chunk); // push: feed bytes as they arrive

  let token;
  while ((token = decoder.readToken()) !== undefined) {
    // pull: drain decodable tokens, then wait for more bytes
    handle(token);
  }
}

decoder.end();
decoder.checkEOF();
```

`readToken` returns `undefined` when the buffer is exhausted mid-token — that's the signal to go
fetch more bytes, not an error. `end()` tells the decoder no more input is coming; `checkEOF()` then
asserts that what arrived was a complete, well-formed document.

### Composing

The core `JSONTextDecoder` and `JSONTextEncoder` are manual state machines. For common use cases,
use `TransformStream` wrappers that natively compose with fetch, files, and Web Streams.

```javascript
import { JSONTextLineStream, JSONTextSelectorStream } from "jsontext";

// Filter a JSON Lines feed: keep only active users, write them back out as JSONL.
// JSONTextLineStream emits one Value per top-level JSON value — ideal for JSONL and concatenated-JSON.
const encoder = new TextEncoder();

await response.body
  .pipeThrough(new JSONTextLineStream())
  .pipeThrough(
    new TransformStream({
      transform(value, controller) {
        const user = value.json();
        if (user.active) controller.enqueue(encoder.encode(value.text() + "\n"));
      },
    }),
  )
  .pipeTo(destination);

// Or extract a single slice from a large document with a JSONPath selector
response.body.pipeThrough(new JSONTextSelectorStream("$.users[*].email"));
```

Each stream is a thin adapter over the core API, so you can mix hand-driven decoding and stream
piping in the same program without giving up either one's guarantees.

### Locating syntax errors

When input violates RFC 8259, jsontext throws a `SyntacticError` carrying both the byte `offset` and
the JSON `pointer` to help pinpoint the exact failure.

```javascript
import { JSONTextDecoder, SyntacticError } from "jsontext";

try {
  const decoder = new JSONTextDecoder(new TextEncoder().encode(`{"a": 1, "b": }`));
  decoder.end();
  while (decoder.readToken() !== undefined) { /* ... */ }
} catch (error) {
  if (error instanceof SyntacticError) {
    console.error(error.message);
  }
}
```

## Examples

Below are some simple examples demonstrating how to use `jsontext` for common JSON processing tasks.
For more examples, see the [documentation](/docs/).

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
> `JSONTextDecoderStream` supports Token-level processing only. If you need to replace values that
> may be nested inside objects or arrays, you will need to use `JSONTextDecoder` directly.

## License

This project is licensed under the [MIT](LICENSE) License.

## Acknowledgements

This project is inspired by Go's
[`encoding/json/jsontext`](https://pkg.go.dev/encoding/json/jsontext) standard library.
