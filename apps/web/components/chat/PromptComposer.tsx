"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Plus,
  FileText,
  X,
  AlertTriangle,
  Flame,
  Terminal,
  Layers,
  Search,
  Globe,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import type { Mode, Severity } from '../../types/vigil';
import { uploadDocPdf } from '../../lib/api';

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  status?: 'uploading' | 'queued' | 'failed';
}

interface PromptComposerProps {
  currentMode: Mode;
  onChangeMode: (mode: Mode) => void;
  severity: Severity;
  onChangeSeverity: (sev: Severity) => void;
  onSubmit: (content: string, attachments?: AttachedFile[]) => void;
  isGenerating?: boolean;
  placeholder?: string;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  currentMode,
  onChangeMode,
  severity,
  onChangeSeverity,
  onSubmit,
  isGenerating = false,
  placeholder,
}) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashHints = [
    { label: '/runbooks', desc: 'Search runbooks', icon: <FileText className="w-3 h-3 text-[#f04438]" /> },
    { label: '/deploys', desc: 'Diff commits & rollbacks', icon: <Layers className="w-3 h-3 text-amber-400" /> },
    { label: '/live-logs', desc: 'Stream tail error logs', icon: <Terminal className="w-3 h-3 text-emerald-400" /> },
    { label: '/web', desc: 'Cloud status & AWS health', icon: <Globe className="w-3 h-3 text-blue-400" /> },
  ];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return;
    onSubmit(input.trim(), attachedFiles);
    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const picked = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = '';

    for (const file of picked) {
      setAttachedFiles((prev) => [
        ...prev,
        { name: file.name, size: file.size, type: file.type, status: 'uploading' },
      ]);
      try {
        await uploadDocPdf(file);
        setAttachedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: 'queued' } : f))
        );
      } catch {
        setAttachedFiles((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, status: 'queued' } : f))
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
    textareaRef.current?.focus();
  };

  const defaultPlaceholder =
    currentMode === 'incident'
      ? 'Investigating incident: paste error stack, service name, or /live-logs...'
      : currentMode === 'postmortem'
      ? 'Draft postmortem: summarize timeline, blast radius, or root-cause notes...'
      : 'Ask Vigil, paste commit/trace, or type / for runbooks and logs...';

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 1. Mode Pill & Severity Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 mb-2">
        <div className="flex items-center gap-2">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-[#141418] p-1 rounded-full border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() => onChangeMode('ask')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                currentMode === 'ask'
                  ? 'bg-[#22222a] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ask Copilot
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('incident')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                currentMode === 'incident'
                  ? 'bg-gradient-to-r from-[#f04438] to-[#e53e3e] text-white shadow-[0_0_12px_rgba(240,68,56,0.4)] font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-200" />
              Incident
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('postmortem')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                currentMode === 'postmortem'
                  ? 'bg-[#22222a] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Postmortem
            </button>
          </div>

          {/* Dynamic Severity Selector (revealed in incident mode) */}
          {currentMode === 'incident' && (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200 bg-[#161414] px-2 py-0.5 rounded-full border border-red-500/20">
              <span className="text-[10px] font-mono text-zinc-500 mr-1 uppercase">Severity:</span>
              {(['SEV-1', 'SEV-2', 'SEV-3'] as Severity[]).map((s) => {
                const isActive = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChangeSeverity(s)}
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold transition-all ${
                      isActive
                        ? s === 'SEV-1'
                          ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                          : s === 'SEV-2'
                          ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                          : 'bg-zinc-700 text-zinc-200 ring-1 ring-zinc-500'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Tool Chips / Slash Hints */}
        <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto">
          {slashHints.map((hint) => (
            <button
              key={hint.label}
              type="button"
              onClick={() => insertSlashCommand(hint.label)}
              title={hint.desc}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 border border-white/5 hover:border-white/10 transition-colors"
            >
              {hint.icon}
              <span>{hint.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Main Input Box (Matching screenshot's dark floating container) */}
      <div className="relative rounded-2xl md:rounded-3xl border border-white/[0.12] bg-[#141418]/90 backdrop-blur-xl shadow-2xl transition-all focus-within:border-[#f04438]/50 focus-within:ring-1 focus-within:ring-[#f04438]/30">
        {/* Attached Files Strip */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-1 border-b border-white/[0.06]">
            {attachedFiles.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-[#1c1c24] text-zinc-200 border border-[#f04438]/30"
              >
                <FileText className="w-3.5 h-3.5 text-[#f04438]" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                <span className="text-[10px] text-zinc-500">
                  {file.status === 'uploading'
                    ? 'uploading…'
                    : `(${(file.size / 1024).toFixed(0)}KB)`}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-0.5 hover:text-rose-400 transition-colors rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Area */}
        <div className="px-4 pt-3.5 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            className="w-full bg-transparent text-sm md:text-[15px] text-zinc-100 placeholder-zinc-500 resize-none outline-none leading-relaxed min-h-[42px] max-h-[180px]"
          />
        </div>

        {/* Hidden PDF/File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,text/plain,application/json"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Bottom Control Bar inside the card */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left Actions: Attach PDF Runbook button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all border border-white/5"
              title="Attach Runbook PDF or incident artifact"
            >
              <Plus className="w-4 h-4" />
            </button>

            <span className="hidden md:inline text-[11px] text-zinc-500 font-mono">
              Attach .pdf runbook
            </span>
          </div>

          {/* Right Actions: Send Button */}
          <div className="flex items-center gap-2">
            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && attachedFiles.length === 0) || isGenerating}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                input.trim() || attachedFiles.length > 0
                  ? 'bg-gradient-to-tr from-[#f04438] to-[#ff5b4d] text-white shadow-md shadow-[#f04438]/30 hover:scale-105 active:scale-95'
                  : 'bg-white/5 text-zinc-600 cursor-not-allowed'
              }`}
              title="Submit prompt (Enter)"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Micro-footer note matching screenshot ("Bloom is AI and can make mistakes...") */}
      <div className="text-center mt-2.5">
        <p className="text-[11px] text-zinc-600 font-sans">
          Vigil autonomously coordinates observability tools and runbook actions. Critical changes require HITL operator approval.
        </p>
      </div>
    </div>
  );
};
