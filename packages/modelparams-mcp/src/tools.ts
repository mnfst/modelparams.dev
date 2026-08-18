import {
  CATALOG,
  dropUnsupported,
  getDefaults,
  getModel,
  listModels,
  PROVIDERS,
  resolveByBaseUrl,
  resolveModelId,
  type ModelId,
  type Param,
  type Provider,
} from "modelparams";

/** Everything a tool returns: a JSON-serialisable payload the agent can act on. */
export type ToolPayload = Record<string, unknown>;

function modelIdOf(entry: (typeof CATALOG)[number]): ModelId {
  const suffix = entry.authType === "api_key" ? "" : "-subscription";
  return `${entry.provider}/${entry.model}${suffix}` as ModelId;
}

/** Provider is mandatory: a bare slug gets the qualified ids, never a guess. */
function providerRequired(input: string): ToolPayload | null {
  if (input.includes("/")) return null;
  const slug = input.trim();
  const matches = CATALOG.filter((e) => e.model === slug).map(modelIdOf);
  return {
    error: "provider_required",
    message: `Model ids are \`provider/model\`.${matches.length ? " Retry with one of the ids below." : " Call list_models to find the id."}`,
    ...(matches.length ? { matches } : {}),
  };
}

/** Resolve via base URL when given, else require provider/model. */
function resolveInput(input: { model: string; baseUrl?: string }): {
  id?: string;
  error?: ToolPayload;
} {
  if (input.baseUrl) {
    const byUrl = resolveByBaseUrl(input.baseUrl, input.model);
    if (byUrl.ok) return { id: byUrl.id };
    return {
      error:
        byUrl.reason === "unknown_base_url"
          ? {
              error: "unknown_base_url",
              message: `"${input.baseUrl}" is not a catalog provider endpoint.`,
              knownBaseUrls: byUrl.knownBaseUrls,
            }
          : {
              error: "unknown_model",
              message: `"${input.model}" is not served at that endpoint per the catalog.`,
              provider: byUrl.provider,
              models: byUrl.models.slice(0, 50),
            },
    };
  }
  const needsProvider = providerRequired(input.model);
  if (needsProvider) return { error: needsProvider };
  return { id: input.model };
}

/**
 * Turn an unresolvable model reference into a payload that tells the agent how
 * to recover, rather than a bare error it will retry verbatim.
 */
function unresolved(
  input: string,
  result: Exclude<ReturnType<typeof resolveModelId>, { ok: true }>,
): ToolPayload {
  if (result.reason === "ambiguous") {
    return {
      error: "ambiguous_model",
      message: `"${input}" is published by more than one provider. Retry with one of the qualified ids below.`,
      matches: result.matches,
    };
  }
  return {
    error: "unknown_model",
    message: `"${input}" is not in the catalog. Call list_models to browse, or retry with one of the suggestions below.`,
    suggestions: result.suggestions,
  };
}

function describeParam(param: Param): ToolPayload {
  return {
    path: param.path,
    label: param.label,
    type: param.type,
    group: param.group,
    description: param.description,
    ...(param.default !== undefined ? { default: param.default } : {}),
    ...(param.range ? { range: param.range } : {}),
    ...(param.values ? { values: param.values } : {}),
    ...(param.applicability ? { appliesOnlyWhen: param.applicability } : {}),
  };
}

/**
 * The hero tool: does this request survive contact with the provider?
 *
 * Returns the diagnosis and a corrected payload, so an agent that doesn't want
 * to reason about the rules can just take `safeParams` and proceed.
 */
export function validateModelParams(input: {
  model: string;
  baseUrl?: string;
  params?: Record<string, unknown>;
}): ToolPayload {
  const pre = resolveInput(input);
  if (pre.error) return pre.error;
  const resolved = resolveModelId(pre.id!);
  if (!resolved.ok) return unresolved(input.model, resolved);

  const supplied = input.params ?? {};
  const { params: safeParams, dropped } = dropUnsupported(resolved.id, supplied);
  const entry = getModel(resolved.id);

  return {
    model: resolved.id,
    provider: entry.provider,
    authType: entry.authType,
    ...("requestModel" in entry ? { requestModel: entry.requestModel } : {}),
    valid: dropped.length === 0,
    summary:
      dropped.length === 0
        ? `All ${Object.keys(supplied).length} parameter(s) are accepted by ${resolved.id}.`
        : `${dropped.length} parameter(s) would be rejected or silently ignored by ${resolved.id}.`,
    issues: dropped.map((d) => ({
      path: d.path,
      code: d.code,
      message: d.reason,
      ...(d.conflictsWith ? { conflictsWith: d.conflictsWith } : {}),
    })),
    safeParams,
    docs: `https://modelparams.dev/models/${resolved.id}`,
  };
}

/** Full parameter surface for one model, including conditional rules. */
export function getModelParams(input: { model: string; baseUrl?: string }): ToolPayload {
  const pre = resolveInput(input);
  if (pre.error) return pre.error;
  const resolved = resolveModelId(pre.id!);
  if (!resolved.ok) return unresolved(input.model, resolved);

  const entry = getModel(resolved.id);
  const params = entry.params as readonly Param[];
  return {
    model: resolved.id,
    provider: entry.provider,
    authType: entry.authType,
    ...("requestModel" in entry ? { requestModel: entry.requestModel } : {}),
    parameterCount: params.length,
    params: params.map(describeParam),
    defaults: getDefaults(resolved.id),
    docs: `https://modelparams.dev/models/${resolved.id}`,
  };
}

/** Browse the catalog to find the exact id the other tools expect. */
export function listCatalogModels(input: {
  provider?: string;
  query?: string;
  limit?: number;
}): ToolPayload {
  const { provider, query, limit = 100 } = input;

  if (provider && !PROVIDERS.includes(provider as Provider)) {
    return {
      error: "unknown_provider",
      message: `"${provider}" is not a provider in the catalog.`,
      providers: PROVIDERS,
    };
  }

  let ids = provider ? listModels({ provider: provider as Provider }) : listModels();
  if (query) {
    const needle = query.toLowerCase();
    ids = ids.filter((id) => id.toLowerCase().includes(needle));
  }

  return {
    total: ids.length,
    returned: Math.min(ids.length, limit),
    truncated: ids.length > limit,
    providers: provider ? [provider] : PROVIDERS,
    models: ids.slice(0, limit),
  };
}

/** Which models expose a given knob — the "can I use X anywhere?" question. */
export function findModelsSupporting(input: {
  parameter: string;
  provider?: string;
  limit?: number;
}): ToolPayload {
  const { parameter, provider, limit = 100 } = input;
  const needle = parameter.toLowerCase();

  const matches: { model: ModelId; param: Param }[] = [];
  for (const entry of CATALOG) {
    if (provider && entry.provider !== provider) continue;
    const param = (entry.params as readonly Param[]).find((p) => p.path.toLowerCase() === needle);
    if (param) matches.push({ model: modelIdOf(entry), param });
  }

  if (matches.length === 0) {
    // A near-miss list beats an empty result — the caller usually has the
    // provider's spelling of the parameter, not the catalog's.
    const known = new Set<string>();
    for (const entry of CATALOG) {
      for (const p of entry.params as readonly Param[]) {
        if (p.path.toLowerCase().includes(needle) || needle.includes(p.path.toLowerCase())) {
          known.add(p.path);
        }
      }
    }
    return {
      parameter,
      total: 0,
      message: `No model in the catalog accepts "${parameter}".`,
      similarParameters: [...known].sort().slice(0, 10),
    };
  }

  return {
    parameter,
    total: matches.length,
    returned: Math.min(matches.length, limit),
    truncated: matches.length > limit,
    models: matches.slice(0, limit).map(({ model, param }) => ({
      model,
      type: param.type,
      ...(param.default !== undefined ? { default: param.default } : {}),
      ...(param.range ? { range: param.range } : {}),
      ...(param.values ? { values: param.values } : {}),
      ...(param.applicability ? { appliesOnlyWhen: param.applicability } : {}),
    })),
    docs: `https://modelparams.dev/parameters/${parameter.replace(/\./g, "-")}`,
  };
}
