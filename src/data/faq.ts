// Data-driven FAQ for a model page. Pure function of the catalog entry so it can
// back both the visible Q&A section and the FAQPage JSON-LD without duplicating
// logic. The questions mirror real long-tail queries ("what is the default
// temperature for <model>") and every answer is derived from the tracked data.

import { modelLabel, providerLabel } from "./display.js";
import type { Model, Parameter } from "../schema/model.js";

export interface ModelFaq {
  question: string;
  answer: string;
}

/** Widely-searched sampling knobs, in the order we surface them when present. */
const FAQ_PARAMS = ["temperature", "top_p", "max_tokens", "top_k"];
const MAX_FAQS = 5;

function subjectOf(model: Model): string {
  const auth = model.authType === "subscription" ? " (subscription)" : "";
  return `${providerLabel(model.provider)} ${modelLabel(model)}${auth}`;
}

function defaultAnswer(param: Parameter, subject: string): string {
  let answer = `The default ${param.path} for ${subject} is ${JSON.stringify(param.default)}`;
  if ((param.type === "integer" || param.type === "number") && param.range) {
    const { min, max } = param.range;
    if (min !== undefined && max !== undefined)
      answer += `, within a valid range of ${min} to ${max}`;
    else if (min !== undefined) answer += `, with a minimum of ${min}`;
    else if (max !== undefined) answer += `, with a maximum of ${max}`;
  }
  return `${answer}.`;
}

/** Up to five Q&A pairs for a model, or none when it has no documented parameters. */
export function modelFaq(model: Model): ModelFaq[] {
  if (model.params.length === 0) return [];
  const subject = subjectOf(model);
  const paths = model.params.map((param) => param.path);
  const faqs: ModelFaq[] = [
    {
      question: `How many parameters does ${subject} accept?`,
      answer: `${subject} accepts ${model.params.length} API parameter${
        model.params.length === 1 ? "" : "s"
      }: ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? ", and more" : ""}.`,
    },
  ];
  const byPath = new Map(model.params.map((param) => [param.path, param]));
  for (const path of FAQ_PARAMS) {
    if (faqs.length >= MAX_FAQS) break;
    const param = byPath.get(path);
    if (param && param.default !== undefined) {
      faqs.push({
        question: `What is the default ${path} for ${subject}?`,
        answer: defaultAnswer(param, subject),
      });
    }
  }
  return faqs;
}
