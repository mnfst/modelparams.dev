import { setupWebMCP } from "./webmcp.js";

type AuthFilter = "all" | "api_key" | "subscription";
type SortMode = "provider" | "name" | "params";

interface FilterState {
  query: string;
  auth: AuthFilter;
  providers: Set<string>;
  capabilities: Set<string>;
  sort: SortMode;
}

const state: FilterState = {
  query: "",
  auth: "all",
  providers: new Set(),
  capabilities: new Set(),
  sort: "name",
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

function setupCopyNpm(): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-copy-npm]");
  if (!btn) return;
  const idle = btn.querySelector<HTMLElement>("[data-copy-npm-idle]");
  const done = btn.querySelector<HTMLElement>("[data-copy-npm-done]");
  let timer = 0;
  btn.addEventListener("click", async () => {
    await copyText("npm i modelparams");
    idle?.classList.add("hidden");
    done?.classList.remove("hidden");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      idle?.classList.remove("hidden");
      done?.classList.add("hidden");
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

  updateGroupHeaders();
  syncFilterChrome();
  updateFilterCount();
}

function setupSearch(): void {
  const input = document.querySelector<HTMLInputElement>("[data-search]");
  if (!input) return;
  input.addEventListener("input", () => {
    state.query = input.value.trim().toLowerCase();
    applyFilters();
  });

  const clear = document.querySelector<HTMLButtonElement>("[data-search-clear]");
  clear?.addEventListener("click", () => {
    input.value = "";
    state.query = "";
    applyFilters();
    input.focus();
  });

  // Deep link: /?q=opus pre-fills the search (backs the schema.org SearchAction).
  const initial = new URLSearchParams(window.location.search).get("q");
  if (initial) {
    input.value = initial;
    state.query = initial.trim().toLowerCase();
    applyFilters();
  }
}

function setActive(el: Element, active: boolean): void {
  el.setAttribute("data-active", String(active));
  el.setAttribute("aria-pressed", String(active));
}

function setupAuthFilters(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-auth-filter]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const auth = btn.dataset.authFilter as AuthFilter | undefined;
      if (!auth) return;
      state.auth = auth;
      buttons.forEach((b) => setActive(b, b === btn));
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
        setActive(chip, false);
      } else {
        bucket.add(value);
        setActive(chip, true);
      }
      applyFilters();
    });
  });
}

function hasActiveFilters(): boolean {
  return (
    state.query !== "" ||
    state.auth !== "all" ||
    state.providers.size > 0 ||
    state.capabilities.size > 0
  );
}

function syncFilterChrome(): void {
  const clear = document.querySelector<HTMLElement>("[data-clear-filters]");
  if (clear) clear.classList.toggle("hidden", !hasActiveFilters());

  const searchClear = document.querySelector<HTMLElement>("[data-search-clear]");
  if (searchClear) searchClear.classList.toggle("hidden", state.query === "");

  // The "/" hint and the clear button share the same slot; show one at a time.
  const hint = document.querySelector<HTMLElement>("[data-search-hint]");
  if (hint) hint.style.display = state.query === "" ? "" : "none";
}

function setupClearFilters(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-clear-filters]");
  if (!button) return;
  button.addEventListener("click", () => {
    state.query = "";
    state.auth = "all";
    state.providers.clear();
    state.capabilities.clear();

    const input = document.querySelector<HTMLInputElement>("[data-search]");
    if (input) input.value = "";

    document
      .querySelectorAll<HTMLButtonElement>("[data-auth-filter]")
      .forEach((b) => setActive(b, b.dataset.authFilter === "all"));
    document
      .querySelectorAll<HTMLButtonElement>("[data-provider], [data-capability]")
      .forEach((c) => setActive(c, false));

    applyFilters();
  });
}

const modelList = (): HTMLElement | null => document.querySelector("[data-model-list]");

// Snapshot of the server-rendered order (headers + rows), used to restore grouping.
let originalOrder: Element[] = [];

function updateGroupHeaders(): void {
  const list = modelList();
  if (!list) return;
  const headers = list.querySelectorAll<HTMLElement>("[data-group-header]");

  // Provider headers only make sense in the grouped (provider) ordering.
  if (state.sort !== "provider") {
    headers.forEach((h) => h.classList.add("hidden"));
    return;
  }

  // Show a header only when its group has at least one visible row.
  let current: HTMLElement | null = null;
  let hasVisible = false;
  const finalize = (): void => {
    if (current) current.classList.toggle("hidden", !hasVisible);
  };
  for (const child of Array.from(list.children) as HTMLElement[]) {
    if (child.matches("[data-group-header]")) {
      finalize();
      current = child;
      hasVisible = false;
    } else if (child.classList.contains("model") && !child.classList.contains("hidden")) {
      hasVisible = true;
    }
  }
  finalize();
}

function reorderList(): void {
  const list = modelList();
  if (!list) return;
  if (originalOrder.length === 0) originalOrder = Array.from(list.children);

  if (state.sort === "provider") {
    originalOrder.forEach((el) => list.appendChild(el));
    return;
  }

  const rows = Array.from(list.querySelectorAll<HTMLElement>(".model"));
  rows.sort((a, b) => {
    const nameA = a.dataset.modelName ?? "";
    const nameB = b.dataset.modelName ?? "";
    if (state.sort === "name") return nameA.localeCompare(nameB);
    const byParams = Number(b.dataset.modelParams ?? 0) - Number(a.dataset.modelParams ?? 0);
    return byParams !== 0 ? byParams : nameA.localeCompare(nameB);
  });
  rows.forEach((row) => list.appendChild(row));
}

function setupSort(): void {
  const select = document.querySelector<HTMLSelectElement>("[data-sort]");
  if (!select) return;
  originalOrder = Array.from(modelList()?.children ?? []);
  select.addEventListener("change", () => {
    state.sort = (select.value as SortMode) || "provider";
    reorderList();
    applyFilters();
  });
}

function setupModelLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-model-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      // Leave modified clicks (open in new tab, etc.) to the browser.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      // A plain click navigates to the model page rather than toggling the row.
      event.preventDefault();
      const href = link.getAttribute("href");
      if (href) window.location.href = href;
    });
  });
}

function setupScrollTopButton(): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-scroll-top]");
  const list = document.querySelector<HTMLElement>("[data-model-list]");
  const searchBar = document.querySelector<HTMLElement>(".search-bar");
  if (!btn || !list) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      btn.classList.toggle("hidden", entry.isIntersecting);
      btn.classList.toggle("flex", !entry.isIntersecting);
    },
    { threshold: 0 },
  );

  const firstRow = list.querySelector(".model");
  if (firstRow) observer.observe(firstRow);

  btn.addEventListener("click", () => {
    const target = searchBar || list;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupSearchShortcut(): void {
  const input = document.querySelector<HTMLInputElement>("[data-search]");
  if (!input) return;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
    event.preventDefault();
    input.focus();
  });
}

function setupFilterPanel(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-toggle-filters]");
  const panel = document.querySelector<HTMLElement>("[data-filter-panel]");
  const chevron = document.querySelector<HTMLElement>("[data-filter-chevron]");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isClosed = panel.classList.toggle("filter-panel-closed");
    toggle.setAttribute("aria-expanded", String(!isClosed));
    chevron?.classList.toggle("rotate-180", !isClosed);
  });
}

function updateFilterCount(): void {
  const badge = document.querySelector<HTMLElement>("[data-active-filter-count]");
  if (!badge) return;
  const count = state.providers.size + state.capabilities.size + (state.auth !== "all" ? 1 : 0);
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function setupViewModeToggle(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-view-mode]");
  const grid = document.querySelector<HTMLElement>("[data-provider-grid]");
  const list = document.querySelector<HTMLElement>("[data-provider-list]");
  if (!buttons.length || !grid || !list) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewMode;
      buttons.forEach((b) => {
        const active = b === btn;
        b.setAttribute("data-active", String(active));
        b.setAttribute("aria-pressed", String(active));
      });
      grid.classList.toggle("hidden", mode === "list");
      list.classList.toggle("hidden", mode === "grid");
      list.classList.toggle("flex", mode === "list");
    });
  });
}

function setupJsonModal(): void {
  const dialog = document.getElementById("json-modal") as HTMLDialogElement | null;
  if (!dialog) return;

  const opener = document.querySelector<HTMLButtonElement>("[data-open-json-modal]");
  const closer = document.querySelector<HTMLButtonElement>("[data-close-json-modal]");
  const copyBtn = document.querySelector<HTMLButtonElement>("[data-copy-json]");
  const jsonContent = document.getElementById("json-content");

  opener?.addEventListener("click", () => {
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
  });

  const close = (): void => {
    if (dialog.open) dialog.close();
    document.documentElement.style.overflow = "";
  };

  closer?.addEventListener("click", close);
  dialog.addEventListener("cancel", close);
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  if (copyBtn && jsonContent) {
    const idle = copyBtn.querySelector<HTMLElement>("[data-copy-json-idle]");
    const done = copyBtn.querySelector<HTMLElement>("[data-copy-json-done]");
    const label = copyBtn.querySelector<HTMLElement>("[data-copy-json-label]");
    let timer = 0;
    copyBtn.addEventListener("click", async () => {
      await copyText(jsonContent.textContent?.trim() ?? "");
      idle?.classList.add("hidden");
      done?.classList.remove("hidden");
      if (label) label.textContent = "Copied";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        idle?.classList.remove("hidden");
        done?.classList.add("hidden");
        if (label) label.textContent = "Copy";
      }, 2000);
    });
  }
}

function setupProvidersMenu(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-providers-toggle]");
  const menu = document.querySelector<HTMLElement>("[data-providers-menu]");
  const chevron = document.querySelector<HTMLElement>("[data-providers-chevron]");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const hidden = menu.classList.toggle("providers-menu-hidden");
    chevron?.classList.toggle("rotate-180", !hidden);
  });

  document.addEventListener("click", (e) => {
    if (
      !menu.classList.contains("providers-menu-hidden") &&
      !menu.contains(e.target as Node) &&
      !toggle.contains(e.target as Node)
    ) {
      menu.classList.add("providers-menu-hidden");
      chevron?.classList.remove("rotate-180");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.classList.contains("providers-menu-hidden")) {
      menu.classList.add("providers-menu-hidden");
      chevron?.classList.remove("rotate-180");
    }
  });
}

function setupMobileMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>("[data-mobile-menu]");
  if (!menu) return;
  // Close after a selection or when clicking outside.
  menu
    .querySelectorAll("a, [data-open-how-to-use]")
    .forEach((el) => el.addEventListener("click", () => menu.removeAttribute("open")));
  document.addEventListener("click", (event) => {
    if (menu.open && !menu.contains(event.target as Node)) menu.removeAttribute("open");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupCopyNpm();
  setupHowToUseModal();
  setupCopyHowToUse();
  setupProvidersMenu();
  setupMobileMenu();
  setupJsonModal();
  setupViewModeToggle();
  setupSearch();
  setupAuthFilters();
  setupToggleChips("[data-provider]", "provider", state.providers);
  setupToggleChips("[data-capability]", "capability", state.capabilities);
  setupFilterPanel();
  setupClearFilters();
  setupSort();
  reorderList();
  setupModelLinks();
  setupSearchShortcut();
  setupScrollTopButton();
  updateGroupHeaders();
  syncFilterChrome();
  setupWebMCP();
});
