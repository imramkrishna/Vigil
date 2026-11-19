"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111216]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
        <span className="font-mono-only text-[11px] text-[#7c7e87]">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] text-[#94969e] transition-colors hover:bg-white/[0.06] hover:text-[#ececef]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="dash-scroll overflow-x-auto p-3.5 font-mono-only text-[12.5px] leading-relaxed text-[#d8dae0]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const tokenRegex =
    /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-[#f4f5f7]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="font-mono-only rounded-[5px] border border-white/[0.08] bg-white/[0.05] px-1.5 py-[1px] text-[12.5px] text-[#ececef]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ef8970] underline decoration-[#ef8970]/40 underline-offset-2 transition-colors hover:text-[#ffa58e]"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

interface MarkdownProseProps {
  content: string;
  compact?: boolean;
}

export const MarkdownProse: React.FC<MarkdownProseProps> = ({
  content,
  compact = false,
}) => {
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;
  let blockKey = 0;

  const baseText = compact
    ? "text-[13.5px] leading-[1.65]"
    : "text-[14.5px] leading-[1.7]";

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <CodeBlock
          key={blockKey++}
          language={lang || undefined}
          code={codeLines.join("\n")}
        />
      );
      continue;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3
          key={blockKey++}
          className="mt-4 mb-1.5 text-[14.5px] font-semibold tracking-[-0.01em] text-[#f4f5f7] first:mt-0"
        >
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2
          key={blockKey++}
          className="mt-5 mb-2 text-[16px] font-semibold tracking-[-0.015em] text-[#f4f5f7] first:mt-0"
        >
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1
          key={blockKey++}
          className="mt-5 mb-2.5 border-b border-white/[0.07] pb-2 text-[18px] font-semibold tracking-[-0.02em] text-[#f4f5f7] first:mt-0"
        >
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("> ")) {
        quoteLines.push((lines[i] ?? "").trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={blockKey++}
          className={`my-2.5 border-l-2 border-white/20 pl-3.5 text-[#a7a9b2] ${baseText}`}
        >
          {quoteLines.map((q, idx) => (
            <p key={idx}>{renderInline(q)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={blockKey++} className={`my-2.5 space-y-1.5 pl-5 list-disc text-[#dcdde3] marker:text-[#656770] ${baseText}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={blockKey++} className={`my-2.5 space-y-1.5 pl-5 list-decimal text-[#dcdde3] marker:text-[#7c7e87] ${baseText}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Collect contiguous paragraph lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").trim().startsWith("```") &&
      !(lines[i] ?? "").trim().startsWith("#") &&
      !(lines[i] ?? "").trim().startsWith("> ") &&
      !/^[-*]\s+/.test((lines[i] ?? "").trim()) &&
      !/^\d+\.\s+/.test((lines[i] ?? "").trim())
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }

    blocks.push(
      <p key={blockKey++} className={`my-2 text-[#e2e3e8] first:mt-0 last:mb-0 ${baseText}`}>
        {renderInline(paraLines.join(" "))}
      </p>
    );
  }

  return <div className="min-w-0">{blocks}</div>;
};
