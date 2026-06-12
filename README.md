<div align="center">
  <img width="500" height="91" alt="mps 1" src="https://github.com/user-attachments/assets/5316cfd4-1005-48e5-850c-3e7e9e2f74f1" />
</div>
<hr>

# modelparams.dev

> An open, community-maintained catalog of LLM model parameters.

[![CI](https://github.com/mnfst/modelparams.dev/actions/workflows/ci.yml/badge.svg)](https://github.com/mnfst/modelparams.dev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[modelparams.dev](https://modelparams.dev) is an open-source database that lists the parameters available for popular AI models. It is heavily inspired on [models.dev](https://github.com/anomalyco/models.dev) and we use it at [Manifest](https://manifest.build/).

## API

You can access this data through an API.

```
curl https://modelparams.dev/api/v1/models.json
curl https://modelparams.dev/api/v1/params/gpt-5.5.json
curl https://modelparams.dev/api/v1/params/gpt-5.5-subscription.json
```

The catalog follows the [Model Parameters convention](docs/model-parameters-schema.md).
The generated JSON Schema is available at
`https://modelparams.dev/api/v1/schema.json`.

## Adding a model or a parameter

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

1. Pick a unique ID: `<provider>/<model>` for the API-key variant, `<provider>/<model>-subscription` for the subscription variant. Example: `mistral/mistral-large`.
2. Add a YAML file at `models/<provider>/<model>.yaml` (or `models/<provider>/<model>-subscription.yaml`).
3. Open a PR. CI validates against the schema and rebuilds.

Don't want to open a PR? [File an issue](https://github.com/mnfst/modelparams.dev/issues/new/choose) with the model and a link to the official docs, and someone will pick it up.

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
