import { MCP_CLIENTS, MCP_ENDPOINT, MCP_TOOLS, type McpClient } from "../data/mcp.js";

/**
 * The MCP docs page as a fully self-contained HTML document — no external
 * stylesheet or script, so the Vercel function that serves the `/mcp` endpoint
 * can also answer a browser GET with this page without touching the static
 * build's filesystem.
 */
export function renderMcpHtml(): string {
  const clients = MCP_CLIENTS;
  const tools = MCP_TOOLS;

  const clientButtons = clients
    .map(
      (client, i) => `
        <button type="button" data-client="${client.id}" class="client${i === 0 ? " active" : ""}">${esc(client.name)}</button>`,
    )
    .join("");

  const clientPanels = clients
    .map(
      (client, i) => `
        <div class="panel${i === 0 ? "" : " hidden"}" data-panel="${client.id}">
          ${client.note ? `<p class="note">${esc(client.note)}</p>` : ""}
          <div class="cmd">
            <pre><code data-cmd="${client.id}">${esc(client.command)}</code></pre>
            <button type="button" class="copy" data-copy="${client.id}">Copy</button>
          </div>
        </div>`,
    )
    .join("");

  const toolSections = tools
    .map(
      (tool) => `
        <section class="tool" id="${esc(tool.name)}">
          <h3><code>${esc(tool.name)}</code></h3>
          <p class="desc">${esc(tool.description)}</p>
          <div class="grid">
            <div>
              <p class="label">Input</p>
              <pre><code>${esc(JSON.stringify(tool.inputSchema, null, 2))}</code></pre>
            </div>
            <div>
              <p class="label">Example output</p>
              <pre><code>${esc(JSON.stringify(tool.example, null, 2))}</code></pre>
            </div>
          </div>
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MCP server · modelparams.dev</title>
<meta name="description" content="A Model Context Protocol server for the modelparams.dev catalog — let a coding agent check which parameters a model accepts before it calls one." />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fafafa; color: #1f2937; }
  @media (prefers-color-scheme: dark) { body { background: #0d0d0d; color: #e5e7eb; } }
  .wrap { max-width: 880px; margin: 0 auto; padding: 0 24px 80px; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
  @media (prefers-color-scheme: dark) { header { border-color: #262626; } }
  .brand { font-weight: 700; letter-spacing: -0.02em; color: inherit; text-decoration: none; }
  .brand span { opacity: 0.55; font-weight: 500; }
  .home { color: #059669; text-decoration: none; font-size: 14px; }
  h1 { font-size: 40px; line-height: 1.1; letter-spacing: -0.03em; margin: 48px 0 8px; }
  .lede { color: #4b5563; max-width: 60ch; margin: 0 0 40px; }
  @media (prefers-color-scheme: dark) { .lede { color: #9ca3af; } }
  h2 { font-size: 22px; letter-spacing: -0.02em; margin: 40px 0 8px; }
  .sub { color: #6b7280; font-size: 14px; margin: 0 0 16px; }
  @media (prefers-color-scheme: dark) { .sub { color: #9ca3af; } }
  code, pre { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
  .endpoint { display: inline-block; background: #1f2937; color: #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
  @media (prefers-color-scheme: dark) { .endpoint { background: #1f1f1f; } }
  .clients { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
  .client { border: 1px solid #d1d5db; background: transparent; color: #374151; border-radius: 999px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
  @media (prefers-color-scheme: dark) { .client { border-color: #374151; color: #d1d5db; } }
  .client.active { background: #1f2937; color: #fff; border-color: #1f2937; }
  @media (prefers-color-scheme: dark) { .client.active { background: #e5e7eb; color: #111; border-color: #e5e7eb; } }
  .hidden { display: none; }
  .note { color: #6b7280; font-size: 13px; margin: 0 0 8px; }
  .cmd { display: flex; align-items: stretch; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  @media (prefers-color-scheme: dark) { .cmd { border-color: #262626; } }
  .cmd pre { margin: 0; padding: 14px 16px; flex: 1; overflow-x: auto; background: #1f2937; color: #e5e7eb; font-size: 13px; }
  @media (prefers-color-scheme: dark) { .cmd pre { background: #1f1f1f; } }
  .copy { border: none; border-left: 1px solid #374151; background: #1f2937; color: #9ca3af; padding: 0 18px; font-size: 13px; cursor: pointer; }
  @media (prefers-color-scheme: dark) { .copy { background: #1f1f1f; } }
  .copy:hover { color: #fff; }
  .tool { border-left: 3px solid #e5e7eb; padding-left: 20px; margin: 28px 0; }
  @media (prefers-color-scheme: dark) { .tool { border-color: #262626; } }
  .tool h3 { margin: 0 0 6px; font-size: 17px; }
  .tool h3 code { color: #059669; }
  .desc { color: #4b5563; font-size: 14px; margin: 0 0 14px; }
  @media (prefers-color-scheme: dark) { .desc { color: #9ca3af; } }
  .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 760px) { .grid { grid-template-columns: 1fr 1fr; } }
  .label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; margin: 0 0 6px; }
  .grid pre { margin: 0; padding: 14px 16px; background: #f3f4f6; border-radius: 8px; overflow-x: auto; font-size: 12px; line-height: 1.5; color: #1f2937; }
  @media (prefers-color-scheme: dark) { .grid pre { background: #1f1f1f; color: #d1d5db; } }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  @media (prefers-color-scheme: dark) { footer { border-color: #262626; } }
  a { color: #059669; }
</style>
</head>
<body>
<header>
  <a class="brand" href="/">modelparams.dev <span>/ MCP server</span></a>
  <a class="home" href="/">← Back to catalog</a>
</header>
<div class="wrap">
  <h1>MCP server</h1>
  <p class="lede">Give your coding agent the catalog, so it can check which parameters a model accepts before it calls one — instead of guessing from training data and eating a 400, or worse, having a parameter silently ignored. Hosted over Streamable HTTP, nothing to install.</p>

  <p class="label">Endpoint</p>
  <code class="endpoint">${esc(MCP_ENDPOINT)}</code>

  <h2>Connect a client</h2>
  <p class="sub">Pick a client to see its install command.</p>
  <div class="clients">${clientButtons}</div>
  ${clientPanels}

  <h2>Tools</h2>
  <p class="sub">Four read-only tools, all answering from the catalog this site is serving.</p>
  ${toolSections}

  <footer>
    Prefer a plain file? The whole catalog, including this MCP server, is described in
    <a href="/llms.txt">/llms.txt</a> and <a href="/llms-full.txt">/llms-full.txt</a>.
  </footer>
</div>
<script>
  (function () {
    var clients = document.querySelectorAll("[data-client]");
    var panels = document.querySelectorAll("[data-panel]");
    var copyButtons = document.querySelectorAll("[data-copy]");
    clients.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-client");
        clients.forEach(function (b) { b.classList.toggle("active", b === btn); });
        panels.forEach(function (p) { p.classList.toggle("hidden", p.getAttribute("data-panel") !== id); });
      });
    });
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
      }
      return Promise.resolve(legacyCopy(text));
    }
    function legacyCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }
    copyButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-copy");
        var code = document.querySelector('[data-cmd="' + id + '"]');
        if (!code) return;
        copyText(code.textContent.trim()).then(function () {
          var original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = original; }, 2000);
        });
      });
    });
  })();
</script>
</body>
</html>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
