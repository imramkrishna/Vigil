"use client";

import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import type { Citation } from '../../types/vigil';

type Log = { timestamp: string; level: 'ERROR' | 'WARN' | 'INFO'; message: string; traceId?: string };
type Deploy = { commit: string; author: string; message: string; diffStat: string };
type Tab = 'all' | 'sources' | 'logs' | 'deploys';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  liveLogs?: Log[];
  deployDiffs?: Deploy[];
}

const LEVEL: Record<Log['level'], { bar: string; text: string }> = {
  ERROR: { bar: 'bg-rose-400', text: 'text-rose-300' },
  WARN: { bar: 'bg-amber-400', text: 'text-amber-300' },
  INFO: { bar: 'bg-zinc-500', text: 'text-zinc-400' },
};

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
    >
      {done ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

const Heading: React.FC<{ children: React.ReactNode; count: number }> = ({ children, count }) => (
  <div className="flex items-center justify-between px-1 pb-2">
    <h4 className="text-[12px] font-medium text-zinc-400">{children}</h4>
    <span className="text-[11px] tabular-nums text-zinc-600">{count}</span>
  </div>
);

const rowStyle = (i: number) => ({ animationDelay: `${i * 45}ms` });
const row =
  'dash-rise group relative cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-white/[0.14] hover:bg-white/[0.04]';

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  citations,
  liveLogs = [],
  deployDiffs = [],
}) => {
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState<string | null>(null);

  if (!isOpen) return null;

  const total = citations.length + liveLogs.length + deployDiffs.length;
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: total },
    { id: 'sources', label: 'Sources', n: citations.length },
    { id: 'logs', label: 'Logs', n: liveLogs.length },
    { id: 'deploys', label: 'Deploys', n: deployDiffs.length },
  ];
  const show = (t: Tab) => tab === 'all' || tab === t;
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  return (
    <aside className="dash-slide z-40 flex h-full w-80 flex-col border-l border-white/[0.06] bg-[#0b0c0f] md:w-[380px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[14px] font-medium text-white">Evidence</h3>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="dash-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
              tab === t.id ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            {t.label}
            <span className="text-[11px] tabular-nums text-zinc-500">{t.n}</span>
          </button>
        ))}
      </div>

      <div key={tab} className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {total === 0 && (
          <div className="dash-fade flex flex-col items-center gap-4 pt-16 text-center">
            <span className="relative flex h-3 w-3">
              <span className="dash-ping absolute inline-flex h-full w-full rounded-full bg-[#ff6b4a]" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff6b4a]" />
            </span>
            <div>
              <p className="text-[13.5px] text-zinc-300">Listening for evidence</p>
              <p className="mt-1 text-[12.5px] text-zinc-600">Runbooks, logs and deploys show up as Vigil finds them.</p>
            </div>
          </div>
        )}

        {show('sources') && citations.length > 0 && (
          <section>
            <Heading count={citations.length}>Sources</Heading>
            <div className="space-y-2">
              {citations.map((c, i) => {
                const id = `s-${c.sourceId}`;
                const expanded = open === id;
                return (
                  <div key={id} role="button" tabIndex={0} onClick={() => toggle(id)} onKeyDown={(e) => e.key === 'Enter' && toggle(id)} className={row} style={rowStyle(i)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-zinc-100">{c.title}</span>
                      {c.sourceUrl && (
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Open source"
                          className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className={`mt-1.5 border-l-2 border-[#ff6b4a]/50 pl-2.5 text-[12.5px] leading-relaxed text-zinc-400 ${expanded ? '' : 'line-clamp-2'}`}>
                      {c.snippet}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {show('logs') && liveLogs.length > 0 && (
          <section>
            <Heading count={liveLogs.length}>Logs</Heading>
            <div className="space-y-2">
              {liveLogs.map((l, i) => {
                const id = `l-${i}`;
                const expanded = open === id;
                return (
                  <div key={id} role="button" tabIndex={0} onClick={() => toggle(id)} onKeyDown={(e) => e.key === 'Enter' && toggle(id)} className={`${row} overflow-hidden pl-4`} style={rowStyle(i)}>
                    <span className={`absolute inset-y-0 left-0 w-[3px] ${LEVEL[l.level].bar}`} />
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-zinc-500">{l.timestamp}</span>
                      <span className={`font-medium ${LEVEL[l.level].text}`}>{l.level}</span>
                    </div>
                    <p className={`mt-1 text-[12.5px] leading-relaxed text-zinc-200 ${expanded ? '' : 'line-clamp-2'}`}>{l.message}</p>
                    {expanded && l.traceId && (
                      <div className="dash-rise mt-2 flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5">
                        <span className="font-mono-only truncate text-[11px] text-zinc-500">{l.traceId}</span>
                        <CopyButton value={l.traceId} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {show('deploys') && deployDiffs.length > 0 && (
          <section>
            <Heading count={deployDiffs.length}>Deploys</Heading>
            <div className="space-y-2">
              {deployDiffs.map((d, i) => {
                const [added, removed] = [d.diffStat.match(/\+(\d+)/)?.[1], d.diffStat.match(/-(\d+)/)?.[1]];
                return (
                  <div key={d.commit} className={row} style={rowStyle(i)}>
                    <p className="text-[13px] leading-relaxed text-zinc-100">{d.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className="font-mono-only rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-300">{d.commit}</span>
                        <CopyButton value={d.commit} />
                        <span>· {d.author}</span>
                      </span>
                      <span className="font-mono-only tabular-nums">
                        {added && <span className="text-emerald-400">+{added}</span>}
                        {removed && <span className="ml-1.5 text-rose-400">−{removed}</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};
