"use client";

import { useState } from "react";

const DRAFT = `## Summary
From 14:01 to 14:16 UTC, EU-West checkout requests failed with timeouts (34% error rate). A deploy lowered the database connection pool below what the workers needed.

## Impact
- Region: eu-west-1
- 1,420 checkout attempts delayed or failed
- 18% of the monthly error budget used

## Root cause
Deploy v2.14.8 cut the pgBouncer pool from 40 to 15 while 64 workers kept running.

## What went well
- Vigil identified the cause within 8 seconds.
- The rollback was approved and applied in under 3 minutes.

## Action items
- Roll back checkout-api to v2.14.7 (done)
- Add a CI check on pool size (platform-db-team, 5 days)
- Alert when pgBouncer waiting clients stay above 25 (sre-core, 3 days)`;

export function PostmortemEditorView() {
  const [text, setText] = useState(DRAFT);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [published, setPublished] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
            INC-2048 postmortem
          </h2>
          <p className="mt-0.5 text-[13px] text-[#9c9c9d]">
            Drafted from the timeline and sources. Edit anything before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["preview", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-[12.5px] font-medium capitalize ${
                  mode === m ? "bg-white/15 text-white" : "text-[#9c9c9d] hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPublished(true)}
            className="keycap-download-btn !px-4 !py-2 !text-[13px]"
          >
            {published ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      <div className="command-launcher-glass p-6">
        {mode === "edit" ? (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPublished(false);
            }}
            rows={20}
            aria-label="Postmortem text"
            className="font-mono-only w-full resize-y rounded-lg border border-white/10 bg-[#07080a] p-4 text-[13px] leading-relaxed caret-[#ff6b4a] outline-none focus:border-[#ff6b4a]"
          />
        ) : (
          <div className="max-w-[720px] space-y-3 text-[14px] leading-relaxed text-[#d4d4d5]">
            {text.split("\n\n").map((block, i) =>
              block.startsWith("## ") ? (
                <h3 key={i} className="pt-2 text-[16px] font-semibold text-white">
                  {block.slice(3)}
                </h3>
              ) : (
                <p key={i} className="whitespace-pre-line">
                  {block}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
