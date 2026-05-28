# Performance

This section focuses on memory performance. When processing huge files, the goal is to keep the
memory baseline flat and GC pauses to an absolute minimum, entirely independent of the input size.

> [!NOTE]
> The following examples are run on `Node.js` using a 1 GB JSON file. Performance profiling is
> generated via `clinic`.

## Passthrough

This scenario demonstrates the absolute base cost of parsing. We use the core `JSONTextDecoder` to
read chunks from a 1 GB file, tokenize them, and immediately discard the tokens.

```javascript
import { createReadStream } from "node:fs";
import { JSONTextDecoder } from "jsontext";

const decoder = new JSONTextDecoder();
const stream = createReadStream("data.json");

for await (const chunk of stream) {
  decoder.push(chunk);

  while (decoder.readToken() !== undefined) {
    /** Drain */
  }
}

decoder.end();
decoder.checkEOF();
```

![Passthrough Result](https://github.com/user-attachments/assets/6d8d795b-ba11-41c1-8993-ac5e15088524)

## Round Trip

This scenario represents a full I/O cycle. We stream bytes from the 1 GB file, decode them into
Tokens using the core `JSONTextDecoder`, immediately feed those tokens into `JSONTextEncoder`, and
write the re-encoded bytes to a destination `/dev/null`.

```javascript
import { createReadStream, createWriteStream } from "node:fs";
import { JSONTextDecoder, JSONTextEncoder } from "jsontext";

const input = createReadStream("data.json");
const output = createWriteStream("/dev/null");
const decoder = new JSONTextDecoder();
const encoder = new JSONTextEncoder();

for await (const chunk of input) {
  decoder.push(chunk);

  for (let token; (token = decoder.readToken()) !== undefined;) {
    encoder.writeToken(token);
  }

  const bytes = encoder.takeBytes();

  if (bytes.length > 0) {
    output.write(bytes);
  }
}

decoder.end();
decoder.checkEOF();
output.end();
```

![Round Trip Result](https://github.com/user-attachments/assets/f8c6fc35-0227-40c3-98a2-c9503a366299)

> [!IMPORTANT]
> Using `JSONTextDecoderStream` and `JSONTextEncoderStream` directly in Node.js requires `.toWeb()`
> to convert to Web Streams, which adds an extra buffering layer and can push Heap Used up to 300 MB
> before triggering GC in this scenario.

## Query

This scenario demonstrates a data querying use case. We use `JSONTextSelectorStream` with a
descendant JSON Path expression `$..id` to scan the entire 1 GB file. For each match, we call
`json()` to decode the value into a JavaScript object, and keep a count of the total matches.

Since `JSONTextSelectorStream` is a Web Streams `TransformStream`, we use `.toWeb()` to bridge
`Node.js` streams.

```javascript
import { JSONTextSelectorStream } from "jsontext";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const stream = createReadStream("data.json");
const selector = new JSONTextSelectorStream("$..id");
let count = 0;

for await (const value of Readable.toWeb(stream).pipeThrough(selector)) {
  value.json();
  count++;
}

console.log(`Total values: ${count}`);
// Total values: 565255 for the 1 GB file used in this example
```

![Query Result](https://github.com/user-attachments/assets/2a4e679f-e76f-43f5-bece-487d9a925b91)

> [!TIP]
> `JSONTextSelectorStream` only emits matched values, so the frequency of `.enqueue()` calls is low
> bounded by the number of matches, not the number of tokens. This makes the microtask overhead from
> Web Streams acceptable here. In the Round Trip scenario every token triggers an `.enqueue()`,
> which creates enough microtask pressure to push Heap Used to 300 MB and trigger GC. That is why we
> use the core APIs directly there instead.
