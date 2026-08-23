export interface VariantFilters {
  auth: string;
  apiSurface: string;
  capabilities: Set<string>;
}

function variantMatches(panel: HTMLElement, filters: VariantFilters): boolean {
  if (filters.auth !== "all" && panel.dataset.variantAuth !== filters.auth) return false;
  if (filters.apiSurface !== "all" && panel.dataset.variantSurface !== filters.apiSurface)
    return false;
  const paths = new Set((panel.dataset.variantCapabilities ?? "").split(/\s+/).filter(Boolean));
  return [...filters.capabilities].every((capability) => paths.has(capability));
}

function selectVariant(row: HTMLElement, index: string): void {
  row.querySelectorAll<HTMLElement>("[data-model-variant]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.modelVariant !== index);
  });
  row.querySelectorAll<HTMLElement>("[data-model-variant-trigger]").forEach((trigger) => {
    const active = trigger.dataset.modelVariantTrigger === index;
    trigger.dataset.active = String(active);
    trigger.setAttribute("aria-selected", String(active));
  });
}

export function syncModelVariants(row: HTMLElement, filters: VariantFilters): boolean {
  const panels = Array.from(row.querySelectorAll<HTMLElement>("[data-model-variant]"));
  const matching = panels.filter((panel) => variantMatches(panel, filters));
  const matchingIds = new Set(matching.map((panel) => panel.dataset.modelVariant));

  row.querySelectorAll<HTMLElement>("[data-model-variant-trigger]").forEach((trigger) => {
    trigger.classList.toggle("hidden", !matchingIds.has(trigger.dataset.modelVariantTrigger));
  });

  const active = panels.find((panel) => !panel.classList.contains("hidden"));
  const selected = active && matching.includes(active) ? active : matching[0];
  if (selected?.dataset.modelVariant !== undefined) {
    selectVariant(row, selected.dataset.modelVariant);
  }
  return matching.length > 0;
}

export function setupModelVariantTabs(): void {
  document.querySelectorAll<HTMLElement>("[data-model-variant-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const row = trigger.closest<HTMLElement>(".model");
      const index = trigger.dataset.modelVariantTrigger;
      if (row && index !== undefined) selectVariant(row, index);
    });
  });
}
