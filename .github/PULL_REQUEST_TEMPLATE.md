<!--
New here? CONTRIBUTING.md walks through the file format with a full example:
https://github.com/mnfst/modelparams.dev/blob/main/CONTRIBUTING.md
-->

## What this changes

<!-- A line or two. What did you add or fix, and for which model or provider? -->

## Type of change

Tick whatever fits. This just helps reviewers triage; nothing is enforced.

- [ ] Add a model (new YAML file under `models/`)
- [ ] Add a provider (new folder under `models/`, plus a logo)
- [ ] Add or update parameters on an existing model
- [ ] Fix incorrect data (default, range, values, applicability)
- [ ] Site or tooling (code under `src/`, docs, CI)

## Source

<!-- For data changes, link the official provider docs that back this up. -->

## Before opening

- [ ] `npm run validate` and `npm test` pass locally
- [ ] Filenames follow the convention: `models/<provider>/<model>.yaml`, or `<model>-subscription.yaml` for the subscription route
- [ ] No existing parameter was removed (removals are blocked, see CONTRIBUTING)
