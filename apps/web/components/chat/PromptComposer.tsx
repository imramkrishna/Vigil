"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Plus,
  FileText,
  X,
  Terminal,
  Layers,
  Loader2,
  Slash,
} from "lucide-react";
import type { Severity } from "../../types/vigil";
import { uploadDocPdf } from "../../lib/api";

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  status?: "uploading" | "queued" | "failed";
}

interface PromptComposerProps {
  severity: Severity;
  onChangeSeverity: (sev: Severity) => void;
  onSubmit: (content: string, attachments?: AttachedFile[]) => void;
  isGenerating?: boolean;
  placeholder?: string;
  showDisclaimer?: boolean;
}

const SLASH_TOOLS = [
  { label: "/deploys", desc: "Inspect recent commits & diffs", icon: Layers },
  { label: "/live-logs", desc: "Tail recent service error logs", icon: Terminal },
  { label: "/runbooks", desc: "Search indexed runbooks", icon: FileText },
];

export const PromptComposer: React.FC<PromptComposerProps> = ({
  severity,
  onChangeSeverity,
  onSubmit,
  isGenerating = false,
  placeholder,
  showDisclaimer = true,
}) => {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toolsOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return;
    onSubmit(input.trim(), attachedFiles);
    setInput("");
    setAttachedFiles([]);
    setToolsOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of picked) {
      setAttachedFiles((prev) => [
        ...prev,
        { name: file.name, size: file.size, type: file.type, status: "uploading" },
      ]);
      try {
        await uploadDocPdf(file);
        setAttachedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: "queued" } : f))
        );
      } catch {
        setAttachedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: "failed" } : f))
        );
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const insertSlashCommand = (cmd: string) => {
    if (!input.includes(cmd)) {
      setInput((prev) => (prev ? `${prev} ${cmd} ` : `${cmd} `));
    }
    setToolsOpen(false);
    textareaRef.current?.focus();
  };

  const defaultPlaceholder =
    "Describe the deployment failure, paste an error trace, or name a service...";

  const canSend =
    (input.trim().length > 0 || attachedFiles.length > 0) && !isGenerating;

  return (
    <div className="mx-auto w-full max-w-[740px]">
      <div className="relative rounded-[24px] border border-white/[0.1] bg-[#202126] shadow-[0_10px_32px_-12px_rgba(0,0,0,0.6)] transition-all focus-within:border-white/[0.22] focus-within:ring-1 focus-within:ring-white/[0.06]">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-5 pt-3.5 pb-2.5">
            {attachedFiles.map((file, idx) => (
              <span
                key={`${file.name}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[12px] text-[#dcdde3]"
              >
                <FileText className="h-3.5 w-3.5 text-[#94969e]" aria-hidden="true" />
                <span className="max-w-[160px] truncate">{file.name}</span>
                <span className="font-mono-only text-[10.5px] text-[#7c7e87]">
                  {file.status === "uploading"
                    ? "uploading…"
                    : file.status === "failed"
                      ? "failed"
                      : `${Math.max(1, Math.round(file.size / 1024))}KB`}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeAttachment(idx)}
                  className="cursor-pointer rounded p-0.5 text-[#7c7e87] transition-colors hover:bg-white/[0.08] hover:text-[#ececef]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="px-5 pt-4 pb-1.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            aria-label="Describe deployment failure"
            className="dash-scroll dash-composer-input max-h-[200px] min-h-[44px] w-full resize-none border-0 bg-transparent text-[15px] leading-[1.6] text-[#f2f2f4] placeholder:text-[#7c7f8a] outline-none focus:outline-none focus-visible:outline-none"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pt-1 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[#9b9da6] transition-colors hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-[#f2f2f4]"
              title="Attach PDF runbook"
              aria-label="Attach PDF runbook"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
                title="Insert tool hint"
                className={`flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors ${
                  toolsOpen
                    ? "bg-white/[0.1] text-[#f2f2f4]"
                    : "text-[#9b9da6] hover:bg-white/[0.06] hover:text-[#f2f2f4]"
                }`}
              >
                <Slash className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Tools</span>
              </button>

              {toolsOpen && (
                <div
                  role="menu"
                  className="dash-pop absolute bottom-10 left-0 z-30 w-64 rounded-2xl border border-white/[0.1] bg-[#23252c] p-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.8)]"
                >
                  {SLASH_TOOLS.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        type="button"
                        role="menuitem"
                        onClick={() => insertSlashCommand(tool.label)}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#9b9da6]" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="font-mono-only text-[12px] font-medium text-[#f2f2f4]">
                            {tool.label}
                          </div>
                          <div className="truncate text-[11px] text-[#848791]">
                            {tool.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span
              className="mx-0.5 hidden h-4 w-px bg-white/[0.08] sm:inline-block"
              aria-hidden="true"
            />

            <div
              role="group"
              aria-label="Failure severity"
              className="inline-flex items-center rounded-full bg-white/[0.04] p-0.5"
            >
              {(["SEV-1", "SEV-2", "SEV-3"] as Severity[]).map((s) => {
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChangeSeverity(s)}
                    className={`font-mono-only cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? s === "SEV-1"
                          ? "bg-rose-500/20 text-rose-300"
                          : s === "SEV-2"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-white/[0.11] text-[#f2f2f4]"
                        : "text-[#848791] hover:text-[#d8dae0]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Evaluate failure"
            title="Evaluate (Enter)"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
              canSend
                ? "cursor-pointer bg-[#f2f2f4] text-[#141518] hover:bg-white active:scale-95"
                : "cursor-not-allowed bg-white/[0.07] text-[#666973]"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {showDisclaimer && (
        <p className="mt-2.5 text-center text-[11.5px] text-[#6e717c]">
          Vigil correlates recent deploys, live logs, and indexed runbooks to diagnose failures and suggest fixes.
        </p>
      )}
    </div>
  );
};
