import path from "node:path";
import { ChatOpenAI } from "@langchain/openai";
import type { InteropZodType } from "@langchain/core/utils/types";

export type modelTier = "fast" | "strong";

const PRIMARY_FAST_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_PRIMARY_MODEL = "qwen/qwen-2.5-coder-32b-instruct";
const PRIMARY_STRONG_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_STRONG_MODEL = "meta-llama/llama-3.3-70b-instruct";

export function resolveOpenRouterApiKey(): string {
  if (!process.env.OPENROUTER_API_KEY) {
    try {
      process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
    } catch {
      console.log(".env file was not loaded.");
      // Ignore if root .env is not present
    }
  }
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("API KEY not found. Set OPENROUTER_API_KEY in .env.");
  }
  return apiKey;
}

export function createTierModels(tier: modelTier) {
  const apiKey = resolveOpenRouterApiKey();

  if (tier === "fast") {
    const primary = new ChatOpenAI({
      model: PRIMARY_FAST_MODEL,
      apiKey,
      temperature: 0.1,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
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
      temperature: 0.1,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
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
  } else {
    const primary = new ChatOpenAI({
      model: PRIMARY_STRONG_MODEL,
      apiKey,
      temperature: 0.1,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
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
      temperature: 0.1,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
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
}

export function getModel(tier: modelTier) {
  const { primary, fallback } = createTierModels(tier);
  return primary.withFallbacks({ fallbacks: [fallback] });
}

export function getStructuredModel<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(tier: modelTier, schema: InteropZodType<RunOutput>, name?: string) {
  const { primary, fallback } = createTierModels(tier);
  return primary
    .withStructuredOutput<RunOutput>(schema, { name })
    .withFallbacks({
      fallbacks: [fallback.withStructuredOutput<RunOutput>(schema, { name })],
    });
}
