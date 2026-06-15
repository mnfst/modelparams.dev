<div align="center">
  <img width="500" height="91" alt="mps 1" src="https://github.com/user-attachments/assets/5316cfd4-1005-48e5-850c-3e7e9e2f74f1" />
</div>
<hr>

# modelparams.dev

> An open, community-maintained catalog of LLM model parameters.

[![npm version](https://img.shields.io/npm/v/modelparams.svg)](https://www.npmjs.com/package/modelparams)
[![npm downloads](https://img.shields.io/npm/dm/modelparams.svg)](https://www.npmjs.com/package/modelparams)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Every parameter each AI model accepts, in one place. Inspired by [models.dev](https://github.com/anomalyco/models.dev); we use it at [Manifest](https://manifest.build/).

## TypeScript

```bash
npm install modelparams
```

`ParamsOf<Id>` is the exact set of parameters a model accepts. Pass one it doesn't, and your code won't compile.

```ts
import type { ParamsOf } from "modelparams";
import OpenAI from "openai";

const params: ParamsOf<"openai/gpt-4.1"> = {
  max_tokens: 1024,
  temperature: 0.7,
  // top_k: 40, // won't compile: gpt-4.1 has no top_k
};

await new OpenAI().chat.completions.create({ model: "gpt-4.1", messages, ...params });
```

Defaults, runtime validation, and the helper APIs are in the [package README](packages/modelparams/README.md).

## API

Prefer raw JSON?

```
curl https://modelparams.dev/api/v1/models.json
curl https://modelparams.dev/api/v1/params/gpt-5.5.json
```

Schema at `https://modelparams.dev/api/v1/schema.json`, per the [Model Parameters convention](docs/model-parameters-schema.md).

## Adding a model

Drop a YAML file in `models/<provider>/`, open a PR, and CI validates it against the schema. Details in [CONTRIBUTING.md](CONTRIBUTING.md). Can't open a PR? [File an issue](https://github.com/mnfst/modelparams.dev/issues/new/choose) with a link to the docs.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # → dist/
npm run validate     # check every YAML
npm test
```

## License

MIT
