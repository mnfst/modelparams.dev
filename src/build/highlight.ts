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
