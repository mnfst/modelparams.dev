/**
 * Insert a `## <version>` entry above the newest existing one.
 *
 * Everything before the first entry — the title and the file's explanatory
 * preamble — stays put; without that, prose written for the reader would sink
 * further down the file with every release.
 */
export function insertChangelogEntry(existing: string, version: string, body: string): string {
  const lines = existing.split("\n");
  const firstEntry = lines.findIndex((line) => line.startsWith("## "));
  const preamble = (firstEntry === -1 ? lines : lines.slice(0, firstEntry)).join("\n").trimEnd();
  const entries = firstEntry === -1 ? "" : lines.slice(firstEntry).join("\n").trim();
  const entry = `## ${version}\n\n${body.trim()}`;
  return `${preamble}\n\n${entry}\n${entries ? `\n${entries}\n` : ""}`;
}
