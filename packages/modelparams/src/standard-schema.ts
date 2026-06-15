/**
 * The Standard Schema v1 contract (https://standardschema.dev), vendored as
 * plain types so `paramsSchema(id)` plugs into any Standard-Schema-aware library
 * (tRPC, Hono, TanStack Form, …) with zero runtime dependencies.
 *
 * The contract is structural: a value is a valid Standard Schema as long as its
 * `~standard` property has `{ version: 1, vendor, validate }`.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  readonly types?: StandardSchemaTypes<Input, Output>;
}

export type StandardSchemaResult<Output> = StandardSchemaSuccess<Output> | StandardSchemaFailure;

export interface StandardSchemaSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaFailure {
  readonly issues: readonly StandardSchemaIssue[];
}

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | StandardSchemaPathSegment)[] | undefined;
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}
