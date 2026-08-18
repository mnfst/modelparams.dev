/**
 * Rewrite the version uv.lock records for the root `modelparams` package.
 *
 * The lockfile pins the project's own version, so bumping pyproject.toml alone
 * makes every `uv sync --locked` in CI refuse with "the lockfile needs to be
 * updated". This mirrors the one line `uv version` would change; the editable
 * root package carries no hash, so nothing else in the lock depends on it.
 */
export function bumpUvLockVersion(source: string, next: string): string {
  const pattern = /(\[\[package]]\nname = "modelparams"\nversion = ")\d+\.\d+\.\d+(")/;
  if (!pattern.test(source)) {
    throw new Error("could not find the modelparams package entry in uv.lock");
  }
  return source.replace(pattern, `$1${next}$2`);
}
