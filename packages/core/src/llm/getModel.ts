import path from "node:path";
import { ChatOpenAI } from "@langchain/openai";

export type modelTier = "fast" | "strong";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const PRIMARY_FAST_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_PRIMARY_MODEL = "qwen/qwen-2.5-coder-32b-instruct";
const PRIMARY_STRONG_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_STRONG_MODEL = "meta-llama/llama-3.3-70b-instruct";

export interface GetModelOptions {
  orgId?: string;
  graph?: "incident";
  threadId?: string;
  node?: string;
  temperature?: number;
}

export function resolveOpenRouterApiKey(): string {
  if (!process.env.OPENROUTER_API_KEY) {
    try {
      process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
    } catch {
      console.log(".env file was not loaded.");
    }
  }
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("API KEY not found. Set OPENROUTER_API_KEY in .env.");
  }
  return apiKey;
}

export function createTierModels(tier: modelTier, opts: GetModelOptions = {}) {
  const apiKey = resolveOpenRouterApiKey();

  if (tier === "fast") {
    const primary = new ChatOpenAI({
      model: PRIMARY_FAST_MODEL,
      apiKey,
      temperature: opts.temperature ?? 0.1,
      configuration: {
        baseURL: OPENROUTER_BASE_URL,
        apiKey,
      },
      timeout: 15_000,
      maxRetries: 2,
      modelKwargs: {
        provider: {
          allow_fallbacks: false,
        },
      },
    });

    const fallback = new ChatOpenAI({
      model: FALLBACK_PRIMARY_MODEL,
      apiKey,
      temperature: opts.temperature ?? 0.1,
      configuration: {
        baseURL: OPENROUTER_BASE_URL,
        apiKey,
      },
      timeout: 15_000,
      maxRetries: 2,
      modelKwargs: {
        provider: {
          allow_fallbacks: false,
        },
      },
    });

    return { primary, fallback };
  }

  const primary = new ChatOpenAI({
    model: PRIMARY_STRONG_MODEL,
    apiKey,
    temperature: opts.temperature ?? 0.1,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      apiKey,
    },
    timeout: 30_000,
    maxRetries: 2,
    modelKwargs: {
      provider: {
        allow_fallbacks: false,
      },
    },
  });

  const fallback = new ChatOpenAI({
    model: FALLBACK_STRONG_MODEL,
    apiKey,
    temperature: opts.temperature ?? 0.1,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      apiKey,
    },
    timeout: 30_000,
    maxRetries: 2,
    modelKwargs: {
      provider: {
        allow_fallbacks: false,
      },
    },
  });

  return { primary, fallback };
}

export function getModel(tier: modelTier, opts: GetModelOptions = {}) {
  const { primary, fallback } = createTierModels(tier, opts);
  return primary.withFallbacks({ fallbacks: [fallback] });
}
