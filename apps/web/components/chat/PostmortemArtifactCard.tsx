"use client";

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Flame,
  ListTodo,
  ExternalLink,
  Download,
} from 'lucide-react';
import type { ActionItem } from '../../types/vigil';

interface PostmortemArtifactCardProps {
  postmortemMarkdown?: string;
  actionItems?: ActionItem[];
  title?: string;
  incidentId?: string;
  onToggleActionItem?: (index: number) => void;
}

export const PostmortemArtifactCard: React.FC<PostmortemArtifactCardProps> = ({
  postmortemMarkdown = '',
  actionItems = [],
  title = 'Incident Postmortem Report',
  incidentId = 'INC-2026-8841',
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'actions' | 'raw'>('preview');
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(postmortemMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([postmortemMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postmortem-${incidentId.toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleItem = (idx: number) => {
    setCompletedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getPriorityBadge = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'P0':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Flame className="w-3 h-3 text-rose-400" />
            P0 Blocker
          </span>
        );
      case 'P1':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-zinc-400" />
            P1 High
          </span>
        );
      case 'P2':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
            P2 Normal
          </span>
        );
    }
  };

  // Simple clean markdown parser for sections
  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10">
            {trimmed.slice(2)}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-sm font-semibold text-[#f04438] mt-3.5 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f04438]"></span>
            {trimmed.slice(3)}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-xs font-semibold text-zinc-200 mt-2.5 mb-1 uppercase tracking-wider font-mono">
            {trimmed.slice(4)}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-zinc-300 leading-relaxed my-0.5">
            {trimmed.slice(2)}
          </li>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-2 border-[#f04438] pl-3 py-1 my-2 bg-white/[0.02] text-xs text-zinc-300 italic">
            {trimmed.slice(2)}
          </blockquote>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }
      return (
        <p key={idx} className="text-xs text-zinc-300 leading-relaxed my-1">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="my-3.5 rounded-xl border border-white/10 bg-[#121216]/95 backdrop-blur-md overflow-hidden shadow-lg">
      {/* Top Banner */}
      <div className="p-4 bg-gradient-to-r from-[#17171d] via-[#1a1a24] to-[#17171d] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f04438]/15 border border-[#f04438]/30 flex items-center justify-center text-[#f04438]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#f04438] font-bold">
                Generated Artifact
              </span>
              <span className="text-[11px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                {incidentId}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
        </div>

        {/* Tab Controls & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white/10 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Report Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'actions'
                  ? 'bg-white/10 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListTodo className="w-3 h-3" />
              Action Items ({actionItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'raw'
                  ? 'bg-white/10 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Raw MD
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1 text-xs"
            title="Copy Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            title="Download .md file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-4">
        {activeTab === 'preview' && (
          <div className="space-y-1 bg-[#0b0b0e]/70 p-4 rounded-xl border border-white/5 max-h-96 overflow-y-auto">
            {renderFormattedMarkdown(postmortemMarkdown)}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-white/5">
              <span>Follow-up engineering tasks generated from root-cause analysis</span>
              <span className="font-mono text-[11px]">
                {Object.values(completedItems).filter(Boolean).length} / {actionItems.length} Resolved
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 font-mono text-[10.5px] uppercase">
                    <th className="py-2 px-3 w-8">Done</th>
                    <th className="py-2 px-3">Priority</th>
                    <th className="py-2 px-3">Action Item</th>
                    <th className="py-2 px-3">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {actionItems.map((item, idx) => {
                    const isDone = completedItems[idx];
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isDone ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => toggleItem(idx)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-white/20 hover:border-white/40 bg-black/30'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getPriorityBadge(item.priority)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-200">
                          <span className={isDone ? 'line-through text-zinc-500' : 'font-medium'}>
                            {item.title}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[11px] font-mono text-zinc-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f04438]"></span>
                            @{item.owner}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <pre className="p-3.5 bg-black/60 rounded-xl font-mono text-[11.5px] text-zinc-300 leading-relaxed overflow-x-auto max-h-96 border border-white/5">
            {postmortemMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
};
