// Content for /model-parameters-vs-api-parameters.
//
// "Parameters" has two unrelated meanings in this corner of the world: the
// weight count of a trained model, and the settings you send in an API request.
// The catalog only covers the second, but search engines match model pages
// against weight-count queries ("how many parameters does gpt 3.5 have")
// because the phrasing is identical. This page exists to take that intent so
// the model pages don't have to compete for it.
//
// The FAQ lives here rather than in the view so it can back both the visible
// Q&A and the FAQPage JSON-LD from one source.

export interface DisambiguationFaq {
  question: string;
  answer: string;
}

/**
 * The weight-count questions, answered straight. These are deliberately the
 * phrasings people actually type — this is the one page on the site that
 * should match them.
 */
export function disambiguationFaq(modelCount: number): DisambiguationFaq[] {
  return [
    {
      question: "Does modelparams.dev list how many parameters a model has?",
      answer:
        `No. ${modelCount} models are in the catalog and none of them carry a weight count. ` +
        "We track API parameters, meaning the settings you send in a request. For an " +
        "open-weight model the count is usually in its Hugging Face model card. For a " +
        "closed model there is often no published figure at all.",
    },
    {
      question: "How many parameters does GPT-3.5 have?",
      answer:
        "OpenAI has never published it. The 175 billion figure people repeat belongs to " +
        "GPT-3, which is a different model, and every number quoted for GPT-3.5 and later " +
        "is an estimate rather than a disclosure.",
    },
    {
      question: "Are model parameters and hyperparameters the same thing?",
      answer:
        "No, and that is a third meaning of the word. Hyperparameters are the settings " +
        "used to train a model, like learning rate and batch size. Parameters are the " +
        "weights that training produces. API parameters are what you send at inference " +
        "time. Same word, three unrelated things.",
    },
    {
      question: "Is temperature a model parameter?",
      answer:
        "Temperature is an API parameter. It changes how the output is sampled and is " +
        "not stored in the model. Two requests to the same model at different " +
        "temperatures run against identical weights.",
    },
  ];
}
