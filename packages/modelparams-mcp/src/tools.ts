import {
  CATALOG,
  dropUnsupported,
  getDefaults,
  getModel,
  listModels,
  PROVIDER_ENDPOINTS,
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

/** Resolve via base URL when given, else pass through for catalog resolution. */
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
  // A bare slug is resolved by the catalog: unique → that model, shared by
  // several providers → an ambiguous_model payload with the qualified ids.
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
    apiSurface: entry.apiSurface,
    ...("wireId" in entry ? { wireId: entry.wireId } : {}),
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
    apiSurface: entry.apiSurface,
    ...("wireId" in entry ? { wireId: entry.wireId } : {}),
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.replacement !== undefined ? { replacement: entry.replacement } : {}),
    ...(entry.shutdownOn !== undefined ? { shutdownOn: entry.shutdownOn } : {}),
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

/**
 * Every parameter surface a provider serves, and which models share each one.
 *
 * A provider's models are far less varied than their count suggests: Bedrock's
 * 56 models are four distinct parameter surfaces, because Converse normalises
 * most of them. Returning one profile per surface, with the models pointing at
 * it, is what makes "give me everything you have on this provider" fit in a
 * tool result at all — flat, Bedrock is an order of magnitude larger.
 */
export function listProviderModels(input: {
  provider: string;
  query?: string;
  limit?: number;
}): ToolPayload {
  const { provider, query, limit = 200 } = input;

  if (!PROVIDERS.includes(provider as Provider)) {
    return {
      error: "unknown_provider",
      message: `"${provider}" is not a provider in the catalog.`,
      providers: PROVIDERS,
    };
  }

  let entries = CATALOG.filter((e) => e.provider === provider);
  if (query) {
    const needle = query.toLowerCase();
    entries = entries.filter((e) => modelIdOf(e).toLowerCase().includes(needle));
  }

  const total = entries.length;
  const shown = entries.slice(0, limit);

  // Group by parameter surface. Codegen emits params in a stable order, so the
  // serialised array is a sound identity for "same surface".
  const byShape = new Map<string, { params: readonly Param[]; entries: typeof shown }>();
  for (const entry of shown) {
    const params = entry.params as readonly Param[];
    const shape = JSON.stringify(params);
    const bucket = byShape.get(shape);
    if (bucket) bucket.entries.push(entry);
    else byShape.set(shape, { params, entries: [entry] });
  }

  // Commonest surface first, then alphabetically — so `p1` is the provider's
  // house style and the ids stay stable across identical calls.
  const profiles = [...byShape.values()].sort(
    (a, b) =>
      b.entries.length - a.entries.length ||
      modelIdOf(a.entries[0]!).localeCompare(modelIdOf(b.entries[0]!)),
  );
  const profileOf = new Map<string, string>();
  profiles.forEach((profile, i) => {
    for (const entry of profile.entries) profileOf.set(modelIdOf(entry), `p${i + 1}`);
  });

  const models = shown.map((entry) => {
    const id = modelIdOf(entry);
    return {
      model: id,
      authType: entry.authType,
      apiSurface: entry.apiSurface,
      ...("wireId" in entry ? { wireId: entry.wireId } : {}),
      // Lifecycle travels with the row: a tool whose whole job is helping an
      // agent choose a model must not hand back a retired one unmarked.
      ...(entry.status !== undefined ? { status: entry.status } : {}),
      ...(entry.replacement !== undefined ? { replacement: entry.replacement } : {}),
      ...(entry.shutdownOn !== undefined ? { shutdownOn: entry.shutdownOn } : {}),
      profile: profileOf.get(id),
    };
  });

  // Bedrock reaches most models through a cross-region inference profile, so the
  // wire id carries a placeholder the caller has to fill in. Say so, in the
  // response that hands over those ids, rather than leaving it to the docs.
  const templated = shown.some((e) => "wireId" in e && e.wireId.includes("{scope}"));

  return {
    provider,
    baseUrls: PROVIDER_ENDPOINTS[provider as keyof typeof PROVIDER_ENDPOINTS],
    total,
    returned: shown.length,
    truncated: total > shown.length,
    paramProfiles: profiles.map((profile, i) => ({
      id: `p${i + 1}`,
      modelCount: profile.entries.length,
      parameterCount: profile.params.length,
      params: profile.params.map(describeParam),
      defaults: getDefaults(modelIdOf(profile.entries[0]!) as ModelId),
    })),
    models,
    ...(templated
      ? {
          wireIdNote:
            "A wireId containing {scope} needs one substitution before you send it: the " +
            "routing geography of the inference profile — us, eu, apac, jp, au, ca, sa, or " +
            "global. A wireId without the placeholder is already complete.",
        }
      : {}),
    docs: `https://modelparams.dev/providers/${provider}`,
  };
}
