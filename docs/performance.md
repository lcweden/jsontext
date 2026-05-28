# Performance

This section focuses on memory performance. When processing huge files, the goal is to keep the
memory baseline flat and garbage collection (GC) pauses to an absolute minimum, entirely independent
of the input size.

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
> In this scenario, why don't we just use `JSONTextDecoderStream` and `JSONTextEncoderStream`? In
> `Node.js`, we must use `.toWeb()` to convert the streams to `TransformStream`, which adds an extra
> layer of buffering and memory overhead, `Heap Used` up to 300 MB to trigger GC.

## Query

This scenario demonstrates a data querying use case. We use `JSONTextSelectorStream` with a
descendant JSON Path expression `$..id` to scan the entire 1 GB file. When a match is found, we
actively materialize the subtree into a JavaScript object using `.json()`.

```javascript
import { JSONTextSelectorStream, KIND, Token } from "jsontext";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

const stream = createReadStream("./data_1gb.json");
const selector = new JSONTextSelectorStream("$..id");
let count = 0;

for await (const value of Readable.toWeb(stream).pipeThrough(selector)) {
  value.json();
  count++;
}

console.log(`Total values: ${count}`); // Total values: 565255
```

![Query Result](https://github.com/user-attachments/assets/2a4e679f-e76f-43f5-bece-487d9a925b91)
