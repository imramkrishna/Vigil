"use client";

import React, { useState } from 'react';
import {
  X,
  FileText,
  Terminal,
  Layers,
  Search,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import type { Citation } from '../../types/vigil';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  liveLogs?: Array<{ timestamp: string; level: 'ERROR' | 'WARN' | 'INFO'; message: string; traceId?: string }>;
  deployDiffs?: Array<{ commit: string; author: string; message: string; diffStat: string }>;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  citations,
  liveLogs = [],
  deployDiffs = [],
}) => {
  const [filterType, setFilterType] = useState<'all' | 'citations' | 'logs' | 'deploys'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredCitations = citations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sourceId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = liveLogs.filter(
    (l) =>
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.traceId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 md:w-96 border-l border-white/10 bg-[#0f0f14]/95 backdrop-blur-2xl flex flex-col h-full shadow-2xl z-40 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#f04438]/15 border border-[#f04438]/30 text-[#f04438]">
            <BookOpen className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Evidence & Citations</h3>
            <p className="text-[11px] font-mono text-zinc-500">
              Verified Runbooks, Diffs & Logs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close Evidence Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-white/[0.06] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search verified snippets..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#f04438]"
          />
        </div>

        {/* Tab filters */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded-full transition-colors ${
              filterType === 'all'
                ? 'bg-white/15 text-white font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All ({citations.length + liveLogs.length + deployDiffs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('citations')}
            className={`px-2 py-0.5 rounded-full transition-colors ${
              filterType === 'citations'
                ? 'bg-[#f04438]/20 text-[#f04438] font-bold border border-[#f04438]/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Runbooks ({citations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('logs')}
            className={`px-2 py-0.5 rounded-full transition-colors ${
              filterType === 'logs'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Logs ({liveLogs.length})
          </button>
        </div>
      </div>

      {/* Evidence List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {/* Citations Section */}
        {(filterType === 'all' || filterType === 'citations') && (
          <div className="space-y-2">
            <span className="text-[11px] uppercase font-medium text-zinc-500 tracking-[0.08em] block">
              Grounded Runbook Citations ({filteredCitations.length})
            </span>

            {filteredCitations.map((c, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-[#14141a] border border-white/5 hover:border-white/15 transition-all space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <span className="font-semibold text-zinc-200 truncate text-[11.5px]">{c.title}</span>
                  </div>
                  {c.sourceUrl && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  ID: {c.sourceId}
                </div>

                <blockquote className="bg-black/40 p-2 rounded text-[11px] font-mono text-zinc-300 leading-relaxed border-l-2 border-[#f04438]">
                  "{c.snippet}"
                </blockquote>
              </div>
            ))}
          </div>
        )}

        {/* Live Logs Section */}
        {(filterType === 'all' || filterType === 'logs') && filteredLogs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-[11px] uppercase font-medium text-zinc-500 tracking-[0.08em] block">
              Live Tail Log Evidence ({filteredLogs.length})
            </span>

            {filteredLogs.map((log, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-black/50 border border-white/5 font-mono text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{log.timestamp}</span>
                  <span
                    className={`px-1 rounded font-bold ${
                      log.level === 'ERROR'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {log.level}
                  </span>
                </div>
                <div className="text-zinc-200 break-all leading-tight">
                  {log.message}
                </div>
                {log.traceId && (
                  <div className="text-[10px] text-zinc-500 truncate">
                    trace: {log.traceId}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Deploy Diffs Section */}
        {(filterType === 'all' || filterType === 'deploys') && deployDiffs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-[11px] uppercase font-medium text-zinc-500 tracking-[0.08em] block">
              Deploy Commits & Diffs ({deployDiffs.length})
            </span>

            {deployDiffs.map((d, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-[#14141a] border border-white/5 font-mono text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#f04438] font-bold">sha: {d.commit}</span>
                  <span className="text-zinc-500 text-[10px]">@{d.author}</span>
                </div>
                <p className="text-zinc-300 font-sans text-xs">{d.message}</p>
                <span className="text-[10px] text-emerald-400 block">{d.diffStat}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
