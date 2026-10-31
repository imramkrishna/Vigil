import path from "node:path";
import { ChatOpenAI } from "@langchain/openai";
import type { InteropZodType } from "@langchain/core/utils/types";
import { modelUsage, withOrgContext } from "../db";

export type modelTier = "fast" | "strong";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const PRIMARY_FAST_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_PRIMARY_MODEL = "qwen/qwen-2.5-coder-32b-instruct";
const PRIMARY_STRONG_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_STRONG_MODEL = "meta-llama/llama-3.3-70b-instruct";

export interface GetModelOptions {
  orgId?: string;
  graph?: "ask" | "incident" | "postmortem";
  threadId?: string;
  node?: string;
  temperature?: number;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "qwen/qwen-2.5-coder-32b-instruct": { input: 0.15, output: 0.2 },
  "qwen/qwen-2.5-72b-instruct": { input: 0.35, output: 0.4 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.12, output: 0.3 },
};

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

function createLedgerCallback(modelName: string, opts: GetModelOptions = {}) {
  let startTime = 0;

  return {
    handleLLMStart() {
      startTime = Date.now();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handleLLMEnd(output: any) {
      const latencyMs = Date.now() - startTime;
      const usage =
        output?.llmOutput?.tokenUsage ??
        output?.generations?.[0]?.[0]?.message?.usage_metadata ??
        {};

      const inputTokens = usage.promptTokens ?? usage.input_tokens ?? 0;
      const outputTokens = usage.completionTokens ?? usage.output_tokens ?? 0;

      const rates = MODEL_PRICING[modelName] ?? { input: 0.35, output: 0.4 };
      const costUsd =
        (inputTokens / 1_000_000) * rates.input +
        (outputTokens / 1_000_000) * rates.output;

      if (opts.orgId && opts.graph) {
        try {
          await withOrgContext(opts.orgId, async (tx) => {
            await tx.insert(modelUsage).values({
              orgId: opts.orgId!,
              graph: opts.graph!,
              threadId: opts.threadId ?? null,
              model: modelName,
              inputTokens,
              outputTokens,
              costUsd,
              latencyMs,
            });
          });
        } catch (err) {
          console.error(
            `[Ledger Error] Failed to log usage for ${opts.node ?? modelName}:`,
            err
          );
        }
      }
    },
  };
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
      callbacks: [createLedgerCallback(PRIMARY_FAST_MODEL, opts)],
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
      callbacks: [createLedgerCallback(FALLBACK_PRIMARY_MODEL, opts)],
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
    callbacks: [createLedgerCallback(PRIMARY_STRONG_MODEL, opts)],
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
    callbacks: [createLedgerCallback(FALLBACK_STRONG_MODEL, opts)],
  });

  return { primary, fallback };
}

export function getModel(tier: modelTier, opts: GetModelOptions = {}) {
  const { primary, fallback } = createTierModels(tier, opts);
  return primary.withFallbacks({ fallbacks: [fallback] });
}

