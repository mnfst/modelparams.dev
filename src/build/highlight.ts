/** Escape HTML special characters so highlighted JSON can be injected into markup. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Minimal JSON syntax highlighter. Returns HTML where each token is wrapped in a
 * span with a Tailwind text color, tuned for the site's dark code blocks
 * (`bg-slate-900`). Punctuation is left in the surrounding text color.
 *
 * Colours: keys sky, strings emerald, numbers violet, booleans amber, null rose.
 */
export function highlightJson(json: string): string {
  const token =
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

  return json.replace(token, (match) => {
    let cls = "text-violet-300";
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? "text-sky-300" : "text-emerald-300";
    } else if (/^(true|false)$/.test(match)) {
      cls = "text-amber-300";
    } else if (match === "null") {
      cls = "text-rose-300";
    }
    return `<span class="${cls}">${escapeHtml(match)}</span>`;
  });
}

/**
 * A self-contained code block for JSON: a header bar with a label and a Copy
 * button, and a body that wraps long lines instead of overflowing. The copy
 * button is wired by `[data-json-copy]`; it copies the sibling `<code>` text.
 */
export function jsonBlock(json: string, label = "JSON"): string {
  return `<figure>
  <div class="flex items-center justify-between rounded-t-md border border-slate-200 border-b-0 bg-slate-800 px-4 py-1.5 dark:border-[hsla(60,2%,12%,0.17)] dark:bg-[#161616]">
    <span class="font-mono text-xs font-medium text-slate-400">${escapeHtml(label)}</span>
    <button type="button" data-json-copy class="font-mono text-xs font-medium text-slate-400 hover:text-white">Copy</button>
  </div>
  <pre class="rounded-b-md border border-slate-200 bg-slate-900 px-5 py-4 font-mono text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words dark:border-[hsla(60,2%,12%,0.17)] dark:bg-[#0d0d0d]"><code>${highlightJson(json)}</code></pre>
</figure>`;
}
