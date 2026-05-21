import { setupWebMCP } from "./webmcp.js";

type AuthFilter = "all" | "api_key" | "subscription";

interface FilterState {
  query: string;
  auth: AuthFilter;
  providers: Set<string>;
  capabilities: Set<string>;
}

const state: FilterState = {
  query: "",
  auth: "all",
  providers: new Set(),
  capabilities: new Set(),
};

function setupHowToUseModal(): void {
  const dialog = document.getElementById("how-to-use") as HTMLDialogElement | null;
  if (!dialog || typeof dialog.showModal !== "function") return;

  const openers = document.querySelectorAll<HTMLButtonElement>("[data-open-how-to-use]");
  const closers = document.querySelectorAll<HTMLButtonElement>("[data-close-how-to-use]");

  const open = (): void => {
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
  };

  const close = (): void => {
    if (dialog.open) dialog.close();
    document.documentElement.style.overflow = "";
  };

  openers.forEach((btn) => btn.addEventListener("click", open));
  closers.forEach((btn) => btn.addEventListener("click", close));

  dialog.addEventListener("cancel", close);
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the execCommand path below */
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

function setupCopyHowToUse(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-how-to-use]");
  const source = document.getElementById("how-to-use-md");
  if (!button || !source) return;

  const label = button.querySelector<HTMLElement>("[data-copy-label]");
  const idleIcon = button.querySelector<HTMLElement>("[data-copy-idle]");
  const doneIcon = button.querySelector<HTMLElement>("[data-copy-done]");
  const idleText = label?.textContent ?? "Copy";
  let resetTimer = 0;

  button.addEventListener("click", async () => {
    const copied = await copyText((source.textContent ?? "").trim());
    if (label) label.textContent = copied ? "Copied" : "Press ⌘C";
    idleIcon?.classList.toggle("hidden", copied);
    doneIcon?.classList.toggle("hidden", !copied);
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (label) label.textContent = idleText;
      idleIcon?.classList.remove("hidden");
      doneIcon?.classList.add("hidden");
    }, 2000);
  });
}

function setupThemeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("mp-theme", isDark ? "dark" : "light");
    } catch {
      /* localStorage unavailable; theme reverts on reload */
    }
  });
}

function modelMatches(el: HTMLElement): boolean {
  if (state.auth !== "all" && el.dataset.modelAuth !== state.auth) return false;

  if (state.providers.size > 0 && !state.providers.has(el.dataset.modelProvider ?? ""))
    return false;

  if (state.capabilities.size > 0) {
    const have = new Set((el.dataset.modelCapabilities ?? "").split(/\s+/).filter(Boolean));
    for (const cap of state.capabilities) {
      if (!have.has(cap)) return false;
    }
  }

  if (state.query) {
    const haystack = `${el.dataset.modelName ?? ""} ${el.dataset.modelProvider ?? ""} ${el.dataset.modelId ?? ""}`;
    if (!haystack.includes(state.query)) return false;
  }

  return true;
}

function applyFilters(): void {
  const rows = document.querySelectorAll<HTMLElement>(".model");
  let visible = 0;
  rows.forEach((row) => {
    const show = modelMatches(row);
    row.classList.toggle("hidden", !show);
    if (show) visible++;
  });

  const counter = document.querySelector<HTMLElement>("[data-visible-count]");
  if (counter) counter.textContent = String(visible);

  const empty = document.querySelector<HTMLElement>("[data-empty-state]");
  if (empty) empty.classList.toggle("hidden", visible !== 0);
}

function setupSearch(): void {
  const input = document.querySelector<HTMLInputElement>("[data-search]");
  if (!input) return;
  input.addEventListener("input", () => {
    state.query = input.value.trim().toLowerCase();
    applyFilters();
  });

  // Deep link: /?q=opus pre-fills the search (backs the schema.org SearchAction).
  const initial = new URLSearchParams(window.location.search).get("q");
  if (initial) {
    input.value = initial;
    state.query = initial.trim().toLowerCase();
    applyFilters();
  }
}

function setupAuthFilters(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-auth-filter]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const auth = btn.dataset.authFilter as AuthFilter | undefined;
      if (!auth) return;
      state.auth = auth;
      buttons.forEach((b) => b.setAttribute("data-active", String(b === btn)));
      applyFilters();
    });
  });
}

function setupToggleChips(selector: string, datasetKey: string, bucket: Set<string>): void {
  const chips = document.querySelectorAll<HTMLButtonElement>(selector);
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const value = chip.dataset[datasetKey];
      if (!value) return;
      if (bucket.has(value)) {
        bucket.delete(value);
        chip.setAttribute("data-active", "false");
      } else {
        bucket.add(value);
        chip.setAttribute("data-active", "true");
      }
      applyFilters();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupHowToUseModal();
  setupCopyHowToUse();
  setupSearch();
  setupAuthFilters();
  setupToggleChips("[data-provider]", "provider", state.providers);
  setupToggleChips("[data-capability]", "capability", state.capabilities);
  setupWebMCP();
});
