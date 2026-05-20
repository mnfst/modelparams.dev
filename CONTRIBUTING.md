# Contributing

Thanks for helping build the catalog. There are two main ways to contribute: **adding/updating model data**, and **improving the site itself**.

The formal catalog convention is the [Model Parameters convention](docs/model-parameters-schema.md).

## Adding or updating a model

1. **Pick the filename.** API-key models are bare; subscription models get a `-subscription` suffix.
   - `provider` is the maker's short name in kebab-case: `anthropic`, `openai`, `google`, `mistral`.
   - `model` is the model name in kebab-case: `claude-opus-4-7`, `gpt-4o-mini`, `gemini-2-5-pro`.
   - For `authType: api_key`: `models/<provider>/<model>.yaml` — e.g. `models/anthropic/claude-opus-4-7.yaml`.
   - For `authType: subscription`: `models/<provider>/<model>-subscription.yaml` — e.g. `models/anthropic/claude-opus-4-7-subscription.yaml`.

2. **Start the file with the schema header** so your editor gives you autocomplete:

   ```yaml
   # yaml-language-server: $schema=https://modelparameters.dev/api/v1/schema.json
   ```

3. **Required top-level fields:** `provider`, `authType` (`api_key` or `subscription`), `model`, `params`.

4. **Parameter shape:** each item in `params` has:
   - `path` (required): snake_case, supports dot notation for nested fields (`thinking.type`).
   - `type` (required): one of `boolean`, `enum`, `integer`, `number`, `string`.
   - `label` (required): human-readable name (e.g. `"Max tokens"`).
   - `description` (required): one sentence, ≤500 chars.
   - `group` (required): one of `generation_length`, `sampling`, `reasoning`, `tooling`, `output_format`, `observability`, `provider_metadata`.
   - `default` (optional): a JSON value matching the type.
   - For `enum`: `values: [...]` (required).
   - For `number` / `integer`: `range: { min, max, step }` (optional).
   - `applicability` (optional): conditional rules.

5. **Applicability rules** describe when a parameter is meaningful:
   - `only`: object (or array of objects) of `path: value-or-array`. The parameter applies only when _all_ listed paths match.
   - `except`: object (or array of objects) of `path: value-or-array`. The parameter does _not_ apply when any of the listed conditions match.
   - You can also use `{ not: <value> }` to say "any value except this one".
   - See the [schema doc](docs/model-parameters-schema.md#applicability) for the exact rule syntax and evaluation semantics.

6. **Auth-type rules of thumb:**
   - **`api_key`:** list parameters from the official API reference. Don't invent ones the API doesn't accept.
   - **`subscription`:** list user-facing toggles and presets the consumer can actually set. Skip implementation details.

7. **Validate locally** before opening the PR:

   ```bash
   npm install
   npm run validate
   npm test
   ```

   CI will run the same checks.

## Example

```yaml
# yaml-language-server: $schema=https://modelparameters.dev/api/v1/schema.json
provider: anthropic
authType: api_key
model: claude-sonnet-4-6
params:
  - path: max_tokens
    type: integer
    label: Max tokens
    description: Maximum number of output tokens the model may generate.
    default: 4096
    range:
      min: 1
    group: generation_length

  - path: temperature
    type: number
    label: Temperature
    description: Controls randomness. Lower values are more focused; higher values are more varied.
    default: 1
    range:
      min: 0
      max: 1
      step: 0.1
    group: sampling
    applicability:
      except:
        thinking.type: [adaptive, enabled]

  - path: thinking.type
    type: enum
    label: Thinking mode
    description: Controls whether extended or adaptive thinking is enabled for this model.
    default: disabled
    values: [disabled, adaptive, enabled]
    group: reasoning

  - path: thinking.budget_tokens
    type: integer
    label: Thinking budget tokens
    description: Maximum token budget for extended thinking before producing the final answer.
    default: 4096
    range:
      min: 1024
    group: reasoning
    applicability:
      only:
        thinking.type: enabled
```

## Site changes

The website code lives under `src/`:

- `src/schema/` — Zod types (single source of truth) and JSON Schema generator.
- `src/data/` — YAML loader, catalog builder, display helpers, applicability formatter.
- `src/views/` — EJS templates (layout, partials, index page).
- `src/client/` — browser-side TypeScript (search, filter, dark mode) and Tailwind entry.
- `src/build/` — SSG pipeline (renders pages, compiles assets, emits JSON API).
- `src/server/` — Express dev server.

Conventions:

- TypeScript, ES modules, strict mode.
- No file over 300 lines, no function over 50 lines.
- Format with Prettier, lint with ESLint. `npm run format` and `npm run lint` will set you straight.
- Tests live under `tests/` and run with Vitest.

## Pull requests

- One change per PR, small and focused.
- Make sure CI is green before requesting review.
- For new providers, link to the official docs URL in the PR description.
