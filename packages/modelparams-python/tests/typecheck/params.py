from modelparams.types.anthropic import Claude_Haiku_4_5_20251001Params
from modelparams.types.openai import Gpt_4_1Params

valid_openai: Gpt_4_1Params = {"temperature": 0.7, "max_tokens": 1024}
valid_haiku: Claude_Haiku_4_5_20251001Params = {
    "thinking.type": "enabled",
    "thinking.budget_tokens": 4096,
}
empty: Gpt_4_1Params = {}

bad_enum: Claude_Haiku_4_5_20251001Params = {
    "thinking.type": "off",  # type: ignore[typeddict-item]
}
bad_type: Gpt_4_1Params = {
    "max_tokens": "many",  # type: ignore[typeddict-item]
}
bad_key: Gpt_4_1Params = {
    "top_k": 40,  # type: ignore[typeddict-unknown-key]
}
