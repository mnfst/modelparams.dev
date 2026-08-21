import { MCP_CLIENTS, MCP_ENDPOINT, MCP_TOOLS } from "../data/mcp.js";
import { jsonBlock } from "./highlight.js";

/**
 * The MCP docs page. Rendered as a self-contained HTML document that reuses the
 * site's compiled stylesheet, fonts, and chrome (header/footer/theme) so it is
 * visually identical to every other page — but has no ejs/filesystem dependency,
 * so the Vercel function serving `/mcp` can return it for a browser GET.
 */
export function renderMcpHtml(): string {
  const clientButtons = MCP_CLIENTS.map(
    (client, i) => `
        <button
          type="button"
          data-mcp-client="${client.id}"
          class="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${i === 0 ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-300"}"
        >
          <span class="provider-logo inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">${client.logo}</span>
          ${esc(client.name)}
        </button>`,
  ).join("");

  const clientPanels = MCP_CLIENTS.map(
    (client, i) => `
        <div data-mcp-panel="${client.id}" class="${i === 0 ? "" : "hidden"}">
          ${client.note ? `<p class="mb-2 text-sm text-slate-500 dark:text-slate-400">${esc(client.note)}</p>` : ""}
          <div class="flex items-center border-2 border-slate-700 bg-slate-800 px-5 py-3 dark:border-slate-500 dark:bg-slate-900">
            <pre class="flex-1 overflow-x-auto font-mono text-sm text-slate-200"><code data-mcp-command="${client.id}">${esc(client.command)}</code></pre>
            <button
              type="button"
              data-copy-mcp="${client.id}"
              aria-label="Copy to clipboard"
              class="group ml-6 shrink-0 text-slate-400 hover:text-white"
            >
              <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" data-copy-mcp-idle>
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5" />
              </svg>
              <svg viewBox="0 0 16 16" class="hidden h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" data-copy-mcp-done>
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.5 8.5l3 3 6-6" />
              </svg>
            </button>
          </div>
        </div>`,
  ).join("");

  const toolSections = MCP_TOOLS.map(
    (tool) => `
      <div id="${esc(tool.name)}" class="border-l-2 border-slate-200 pl-5 dark:border-slate-800">
        <h3 class="font-mono text-base font-semibold text-slate-900 dark:text-slate-100">${esc(tool.name)}</h3>
        <p class="mt-1.5 text-sm text-slate-600 dark:text-slate-300">${esc(tool.description)}</p>
        <div class="mt-4 space-y-4">
          ${jsonBlock(JSON.stringify(tool.inputSchema, null, 2), "Input")}
          ${jsonBlock(JSON.stringify(tool.example, null, 2), "Example output")}
        </div>
      </div>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCP server · modelparams.dev</title>
  <meta name="description" content="A Model Context Protocol server for the modelparams.dev catalog — let a coding agent check which parameters a model accepts before it calls one." />
  <link rel="canonical" href="https://modelparams.dev/mcp" />
  <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM-friendly site overview" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="MCP server · modelparams.dev" />
  <meta property="og:description" content="A Model Context Protocol server for the modelparams.dev catalog." />
  <meta property="og:url" content="https://modelparams.dev/mcp" />
  <meta property="og:site_name" content="modelparams.dev" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Ovo&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/styles.css" />
  <script>
    (function () {
      try {
        var stored = localStorage.getItem("mp-theme");
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", (stored || (prefersDark ? "dark" : "light")) === "dark");
      } catch (_e) {}
    })();
  </script>
</head>
<body class="bg-site text-slate-900 dark:text-slate-100 antialiased">

<header class="relative border-b border-slate-200 dark:border-slate-800">
  <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
      <span class="logo-gradient inline-flex h-7 w-7 items-center justify-center rounded-md" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4">
          <g fill="white" opacity="0.7"><path d="M8 16A2 2 0 1 0 8 20 2 2 0 1 0 8 16z"/><path d="m8,11h8c2.76,0,5-2.24,5-5s-2.24-5-5-5h-8c-2.76,0-5,2.24-5,5s2.24,5,5,5Zm8-7.5c1.36,0,2.5,1.14,2.5,2.5s-1.14,2.5-2.5,2.5-2.5-1.14-2.5-2.5,1.14-2.5,2.5-2.5Z"/></g>
          <g fill="white"><path d="m16,13h-8c-2.76,0-5,2.24-5,5s2.24,5,5,5h8c2.76,0,5-2.24,5-5s-2.24-5-5-5Zm0,8h-8c-1.65,0-3-1.35-3-3s1.35-3,3-3h8c1.65,0,3,1.35,3,3s-1.35,3-3,3Z"/></g>
        </svg>
      </span>
      <span class="text-base sm:text-lg">modelparams.dev</span>
    </a>
    <div class="flex items-center gap-1">
      <nav class="hidden items-center gap-1 text-sm sm:flex">
        <a href="/" class="rounded-md px-3 py-1.5 text-slate-600 hover:bg-warm-hover hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">Catalog</a>
        <a href="/api" class="rounded-md px-3 py-1.5 text-slate-600 hover:bg-warm-hover hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">API</a>
        <a href="/mcp" class="rounded-md px-3 py-1.5 text-slate-900 dark:text-white" aria-current="page">MCP</a>
        <a href="https://github.com/mnfst/modelparams.dev" target="_blank" rel="noopener noreferrer" class="rounded-md px-3 py-1.5 text-slate-600 hover:bg-warm-hover hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">GitHub</a>
      </nav>
      <button type="button" data-theme-toggle aria-label="Toggle dark mode" class="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-warm-hover dark:text-slate-300 dark:hover:bg-slate-800">
        <svg class="h-4 w-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <svg class="hidden h-4 w-4 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
        </svg>
      </button>
    </div>
  </div>
</header>

<main class="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
  <nav class="pt-6 text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
    <a href="/" class="hover:text-slate-900 dark:hover:text-white">Home</a>
    <span class="mx-1">/</span>
    <span class="text-slate-700 dark:text-slate-300">MCP</span>
  </nav>

  <section class="pt-6 pb-16">
    <h1 class="tracking-tight">MCP server</h1>
    <p class="mt-3 max-w-2xl text-pretty text-slate-600 dark:text-slate-300">
      Give your coding agent the catalog, so it can check which parameters a model accepts
      before it calls one — instead of guessing from training data and eating a 400, or worse,
      having a parameter silently ignored. Hosted over Streamable HTTP, nothing to install.
    </p>

    <div class="mt-10 max-w-3xl space-y-12">
      <section>
        <h2 class="text-slate-900 dark:text-slate-100">Connect a client</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-300">
          Endpoint: <code class="font-mono text-xs">${esc(MCP_ENDPOINT)}</code>. Pick a client to see its install command.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">${clientButtons}</div>
        <div class="mt-4">${clientPanels}</div>
      </section>

      <section>
        <h2 class="text-slate-900 dark:text-slate-100">Tools</h2>
        <p class="mt-2 text-slate-600 dark:text-slate-300">
          Four read-only tools, all answering from the catalog this site is serving.
        </p>
        <div class="mt-4 space-y-10">${toolSections}</div>
      </section>

      <section>
        <h2 class="text-slate-900 dark:text-slate-100">For agents</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Prefer a plain file? The whole catalog, including this MCP server, is described in
          <a href="/llms.txt" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-hover">/llms.txt</a>
          and
          <a href="/llms-full.txt" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-hover">/llms-full.txt</a>.
        </p>
      </section>
    </div>
  </section>
</main>

<footer class="mt-16 border-t border-slate-200 dark:border-slate-800">
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 gap-8 sm:grid-cols-3">
      <div>
        <span class="text-sm font-semibold text-slate-900 dark:text-white">modelparams.dev</span>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">An open catalog of LLM API parameters.</p>
      </div>
      <div class="flex flex-col gap-2 text-sm">
        <a href="/api" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">API</a>
        <a href="/mcp" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">MCP server</a>
        <a href="/glossary" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Glossary</a>
        <a href="/llms.txt" target="_blank" rel="noopener noreferrer" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">llms.txt</a>
      </div>
      <div class="flex flex-col gap-2 text-sm">
        <a href="/" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Full catalog</a>
        <a href="https://www.npmjs.com/package/modelparams" target="_blank" rel="noopener noreferrer" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">npm package</a>
        <a href="https://github.com/mnfst/modelparams.dev" target="_blank" rel="noopener noreferrer" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">GitHub</a>
      </div>
    </div>
    <div class="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
      &copy; 2026 modelparams.dev &middot; MIT licensed
    </div>
  </div>
</footer>

<script>
  (function () {
    var toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var isDark = document.documentElement.classList.toggle("dark");
        try { localStorage.setItem("mp-theme", isDark ? "dark" : "light"); } catch (_e) {}
      });
    }

    var buttons = document.querySelectorAll("[data-mcp-client]");
    var panels = document.querySelectorAll("[data-mcp-panel]");
    var activeClass = ["border-slate-900", "bg-slate-900", "text-white", "dark:border-white", "dark:bg-white", "dark:text-slate-900"];
    var idleClass = ["border-slate-300", "text-slate-700", "hover:border-slate-500", "dark:border-slate-700", "dark:text-slate-300"];
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-mcp-client");
        buttons.forEach(function (b) {
          var on = b === button;
          b.classList.remove.apply(b.classList, on ? idleClass : activeClass);
          b.classList.add.apply(b.classList, on ? activeClass : idleClass);
        });
        panels.forEach(function (p) { p.classList.toggle("hidden", p.getAttribute("data-mcp-panel") !== id); });
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
      try { ok = document.execCommand("copy"); } catch (_e) {}
      document.body.removeChild(ta);
      return ok;
    }
    var copyButtons = document.querySelectorAll("[data-copy-mcp]");
    copyButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-copy-mcp");
        var code = document.querySelector('[data-mcp-command="' + id + '"]');
        if (!code) return;
        var idle = button.querySelector("[data-copy-mcp-idle]");
        var done = button.querySelector("[data-copy-mcp-done]");
        copyText(code.textContent.trim()).then(function () {
          idle && idle.classList.add("hidden");
          done && done.classList.remove("hidden");
          setTimeout(function () { idle && idle.classList.remove("hidden"); done && done.classList.add("hidden"); }, 2000);
        });
      });
    });

    document.querySelectorAll("[data-json-copy]").forEach(function (button) {
      button.addEventListener("click", function () {
        var figure = button.closest("figure");
        var code = figure && figure.querySelector("code");
        if (!code) return;
        copyText(code.textContent.trim()).then(function () {
          var original = button.textContent;
          button.textContent = "Copied";
          setTimeout(function () { button.textContent = original; }, 2000);
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
