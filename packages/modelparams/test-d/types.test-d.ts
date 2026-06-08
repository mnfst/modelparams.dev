import { expectAssignable, expectError, expectType } from "tsd";
import type { ParamsOf } from "../dist/index.js";

type Haiku = ParamsOf<"anthropic/claude-haiku-4-5-20251001">;

// Allowed: any subset of declared parameters
expectAssignable<Haiku>({});
expectAssignable<Haiku>({ max_tokens: 4096 });
expectAssignable<Haiku>({
  max_tokens: 4096,
  temperature: 0.7,
  "thinking.type": "enabled",
});

// Enum values are narrowed to the catalog's literal union
expectError<Haiku>({ "thinking.type": "off" });

// Unknown keys are rejected
expectError<Haiku>({ definitely_not_a_param: 1 });

// Wrong type for a known key is rejected
expectError<Haiku>({ max_tokens: "lots" });

// All keys are optional (we use Partial)
const empty: Haiku = {};
expectType<Haiku>(empty);
