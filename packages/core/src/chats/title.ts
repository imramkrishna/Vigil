import type { ChatMode } from "../db";
import { getModel } from "../llm";
import { updateConversationTitle } from "./queries";

function fallbackTitleFromMessage(userMessage: string): string {
  const clean = userMessage.replace(/\s+/g, " ").trim();
  if (!clean) return "New evaluation";
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

function sanitizeGeneratedTitle(raw: string, fallback: string): string {
  const firstLine = raw
    .split("\n")[0]
    ?.replace(/^["'`#\-\s]+|["'`.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!firstLine || firstLine.length < 2) return fallback;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
}

export async function generateAndUpdateChatTitle(params: {
  orgId: string;
  conversationId: string;
  threadId?: string;
  userMessage: string;
  assistantResponse?: string;
  mode?: ChatMode;
}): Promise<string> {
  const fallback = fallbackTitleFromMessage(params.userMessage);
  let title = fallback;

  try {
    const model = getModel("fast", {
      orgId: params.orgId,
      graph: params.mode ?? "incident",
      threadId: params.threadId,
      node: "generateChatTitle",
      temperature: 0.2,
    });

    const contextLines = [
      `Mode: ${params.mode ?? "incident"}`,
      `User message: ${params.userMessage.slice(0, 400)}`,
      params.assistantResponse
        ? `Assistant summary: ${params.assistantResponse.slice(0, 300)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await model.invoke([
      {
        role: "system",
        content:
          "Write a short, clear 3 to 7 word title for this engineering operations conversation. " +
          "Preserve exact service names, HTTP codes, or incident IDs when present. " +
          "Return ONLY the plain title text — no quotes, no markdown, no trailing period.",
      },
      {
        role: "user",
        content: contextLines,
      },
    ]);

    const rawText =
      typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .map((part) =>
                typeof part === "string"
                  ? part
                  : "text" in part && typeof part.text === "string"
                    ? part.text
                    : ""
              )
              .join("")
          : "";

    title = sanitizeGeneratedTitle(rawText, fallback);
  } catch {
    title = fallback;
  }

  await updateConversationTitle({
    orgId: params.orgId,
    conversationId: params.conversationId,
    title,
  });

  return title;
}
