# JSONText

[![license](https://img.shields.io/github/license/lcweden/jsontext.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/jsontext.svg)](https://www.npmjs.com/package/jsontext)
[![jsr version](https://img.shields.io/jsr/v/@lcweden/jsontext)](https://jsr.io/@lcweden/jsontext)

JSONText is a low-level, incremental UTF-8 JSON decoder and encoder for token-level processing,
selective extraction, and Web Streams pipelines.

## Installation

### JSR

```bash
deno add jsr:@lcweden/jsontext
```

```javascript
import { JSONTextSelectorStream } from "@lcweden/jsontext";
```

### npm

```bash
npm install jsontext
```

```javascript
import { JSONTextSelectorStream } from "jsontext";
```

JSONText is ESM-only. The core APIs use `Uint8Array` chunks and work in modern JavaScript runtimes.
The `*Stream` APIs require WHATWG Streams support.

## API

See the [JSR API reference](https://jsr.io/@lcweden/jsontext/doc/) for constructors, methods.

## License

This project is licensed under the [MIT](LICENSE) License.

## Acknowledgements

This project is inspired by Go's
[`encoding/json/jsontext`](https://pkg.go.dev/encoding/json/jsontext) standard library package and
.NET's
[`System.Text.Json`](https://learn.microsoft.com/en-us/dotnet/api/system.text.json?view=net-8.0).
