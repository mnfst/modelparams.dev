/**
 * Rewrite the versions package-lock.json records for a workspace package.
 *
 * npm's lockfile mirrors every workspace's own `version` (and the exact pins
 * one workspace puts on another) under a `packages/<dir>` entry. Bumping the
 * workspace package.json alone leaves the lock behind, and `npm ci` then
 * refuses the whole install with "Missing: modelparams@<old> from lock file"
 * — which fails every CI job on the release PR, the required param guard
 * included, so the PR can never merge and nothing ever publishes.
 *
 * This mirrors the handful of lines `npm install --package-lock-only` would
 * change, edited in place so the release commit carries no incidental
 * dependency-tree churn. Same job as `bumpUvLockVersion` does for uv.lock.
 */
export function bumpPackageLockVersion(
  source: string,
  next: string,
  workspaceDir: string,
  /** Workspace siblings this package pins exactly, whose pins move too. */
  repinnedDependencies: string[] = [],
): string {
  const key = `packages/${workspaceDir}`;
  const opening = `\n    ${JSON.stringify(key)}: {`;
  const start = source.indexOf(opening);
  if (start === -1) {
    throw new Error(`could not find the "${key}" entry in package-lock.json`);
  }
  // Entries live two levels deep, so the first four-space-indented closing
  // brace after the opening one ends this entry and no nested object.
  const end = source.indexOf("\n    }", start + opening.length);
  if (end === -1) {
    throw new Error(`could not find the end of the "${key}" entry in package-lock.json`);
  }

  const entry = source.slice(start, end);
  let updated = replaceOnce(
    entry,
    /("version"\s*:\s*")\d+\.\d+\.\d+(")/,
    next,
    `version in the "${key}" entry of package-lock.json`,
  );
  for (const dependency of repinnedDependencies) {
    updated = replaceOnce(
      updated,
      new RegExp(`(${JSON.stringify(dependency)}\\s*:\\s*")\\d+\\.\\d+\\.\\d+(")`),
      next,
      `"${dependency}" pin in the "${key}" entry of package-lock.json`,
    );
  }

  return source.slice(0, start) + updated + source.slice(end);
}

function replaceOnce(source: string, pattern: RegExp, next: string, what: string): string {
  if (!pattern.test(source)) {
    throw new Error(`could not find the ${what}`);
  }
  return source.replace(pattern, `$1${next}$2`);
}
