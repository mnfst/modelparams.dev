import { bumpVersion, type BumpLevel } from "../../../modelparams/scripts/lib/version.js";

export interface PythonReleaseInput {
  seedVersion: string;
  latestVersion: string | null;
  forcedLevel: BumpLevel | null;
  catalogChanged: boolean;
  packageChanged: boolean;
  hasParamRemovals: boolean;
}

export interface PythonReleaseDecision {
  level: BumpLevel | null;
  nextVersion: string | null;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

export function decidePythonRelease(input: PythonReleaseInput): PythonReleaseDecision {
  if (input.latestVersion === null) {
    return { level: input.forcedLevel ?? "patch", nextVersion: input.seedVersion };
  }

  const level =
    input.forcedLevel ??
    (input.hasParamRemovals
      ? "major"
      : input.catalogChanged || input.packageChanged
        ? "patch"
        : null);
  return {
    level,
    nextVersion: level === null ? null : bumpVersion(input.latestVersion, level),
  };
}
