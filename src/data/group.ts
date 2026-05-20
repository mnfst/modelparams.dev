import { ParameterGroup, type Parameter } from "../schema/model.js";

const ORDER = ParameterGroup.options;

export interface ParamGroup {
  group: string;
  params: Parameter[];
}

export function groupParams(params: Parameter[]): ParamGroup[] {
  const buckets = new Map<string, Parameter[]>();
  for (const p of params) {
    const existing = buckets.get(p.group);
    if (existing) existing.push(p);
    else buckets.set(p.group, [p]);
  }
  return ORDER.filter((g) => buckets.has(g)).map((group) => ({
    group,
    params: buckets.get(group)!,
  }));
}
