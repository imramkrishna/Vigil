import { OpenAIEmbeddings } from "@langchain/openai";
import { EMBEDDING_DIMENSIONS } from "../db/schema";
import { resolveOpenRouterApiKey } from "./getModel";

const embeddingModel = "openai/text-embedding-3-small";

export function getEmbeddingModel(): OpenAIEmbeddings {
  const apiKey = resolveOpenRouterApiKey();

  const model = new OpenAIEmbeddings({
    model: embeddingModel,
    dimensions: EMBEDDING_DIMENSIONS,
    apiKey,
    timeout: 15_000,
    maxRetries: 2,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    },
  });

  return model;
}

export const getEmbeddings = getEmbeddingModel;
