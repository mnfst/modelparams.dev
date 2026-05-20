# modelparameters.dev

> An open, community-maintained catalog of LLM model parameters.

[![CI](https://github.com/mnfst/modelparameters.dev/actions/workflows/ci.yml/badge.svg)](https://github.com/mnfst/modelparameters.dev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[modelproviders.dev](https://modelproviders.dev) is an open-source database that lists the parameters available for popular AI models. It is heavily inspired on [models.dev](https://github.com/anomalyco/models.dev) and we use it at [Manifest](https://manifest.build/).

## API

You can access this data through an API.

```
curl https://modelparameters.dev/api/v1/models.json
```

The catalog follows the [Model Parameters convention](docs/model-parameters-schema.md).
The generated JSON Schema is available at
`https://modelparameters.dev/api/v1/schema.json`.

## Adding a model or a parameter

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

1. Pick a unique ID: `<provider>/<model>` for the API-key variant, `<provider>/<model>-subscription` for the subscription variant. Example: `mistral/mistral-large`.
2. Add a YAML file at `models/<provider>/<model>.yaml` (or `models/<provider>/<model>-subscription.yaml`).
3. Open a PR. CI validates against the schema and rebuilds.

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
