# Spec 06: Evaluation Harness

**Status:** Planned
**Depends on:** [Spec 10](./10-local-dev-testing-and-ci.md) (seed data and CI).

---

## 1. Problem

Vigil's answers come from LLMs, prompts and retrieval, and all three change over time. Today nothing checks whether a change made the copilot better or worse. A prompt edit, a model swap in `getModel.ts` or a chunking change can quietly:
- make answers cite the wrong runbook, or none at all,
- make up facts that aren't in any source,
- send the incident agent down the wrong path (wrong tools, too many rounds),
- propose a dangerous or irrelevant remediation action.

Normal unit tests can't catch these, because the output is text that varies from run to run. An **evaluation harness** runs a fixed set of scenarios against the real graph and scores the results.

---

## 2. What to Measure

| Suite | Graph mode | What it checks | How it is scored |
| :--- | :--- | :--- | :--- |
| **Retrieval quality** | (no LLM) | Does `hybridSearch` return the right chunk for a question? | Recall@5 and MRR against labeled "correct chunk" IDs. Fully deterministic. |
| **Groundedness** | `ask` | Is every claim in the answer supported by the cited sources? | LLM judge with a fixed rubric, plus a check that every cited ID really exists in retrieved chunks. |
| **Answer correctness** | `ask` | Does the answer contain the expected key facts? | Keyword/fact match against a reference answer, plus an LLM judge for paraphrases. |
| **Refusal** | `ask` | When the docs don't contain the answer, does Vigil say so instead of guessing? | Pass if the answer admits the information isn't available and makes no unsupported claims. |
| **Incident path** | `incident` | Did the agent call the expected tools (for example `get_recent_deploys` before `formHypotheses`) within the round limit? | Rule-based checks on the recorded tool-call sequence. |
| **Root-cause ranking** | `incident` | Is the true cause the top hypothesis, or at least in the top 3? | Top-1 and top-3 accuracy against labeled scenarios. |
| **Action safety** | `incident` | Is the proposed action allowed, aimed at the right service, and tied to evidence? | Rules: allowed `kind` only, `target` matches the scenario's service, `evidenceIds` not empty and real. |
| **Prompt injection** | `ask` and `incident` | Does injected text in commits, logs or web pages change the agent's behavior? | Pass if the output ignores the injected instruction. Scenarios come from [Spec 07](./07-security-and-threat-model.md). |

---

## 3. Dataset Design

Put the evaluation data in an `evals/` folder at the repo root:

| File | Contents |
| :--- | :--- |
| `evals/fixtures/` | The seed org used for evaluations: runbook PDFs or markdown, services, deploys, past incidents and mock log lines. Built by the same seed script as [Spec 10](./10-local-dev-testing-and-ci.md). |
| `evals/ask.jsonl` | One line per question: the question, expected key facts, expected source document, and whether the answer exists in the docs. |
| `evals/incident.jsonl` | One line per scenario: symptom text, severity, the "true" root cause, the expected tool sequence, and the allowed action kinds. |
| `evals/injection.jsonl` | Malicious commit messages, log lines and web pages, each with the behavior that must **not** happen. |

**Size targets:** start with about 30 Ask questions, 10 incident scenarios and 10 injection cases. Grow the set from real user feedback ([Spec 09](./09-feedback-and-observability.md)): every thumbs-down that turns out to be a real bug becomes a new test case.

**Mock external calls:** during evaluation, swap GitHub, log providers and Firecrawl for fixture-backed fakes, so runs are repeatable and don't use real API quota. Only the LLM calls are real.

---

## 4. Running Evaluations

1. **Command:** a root script (for example `pnpm eval`) runs all suites against a fresh seeded database and prints a score table.
2. **Results file:** each run writes a JSON report (scores per suite, failures with full transcripts, cost and latency) so you can compare runs.
3. **Judge model:** the LLM judge uses a different, pinned model from the one being tested, so a model doesn't grade its own work. The judge prompt is versioned in the repo.
4. **Repeat runs:** LLM output varies, so each case runs 3 times and scores are averaged. A case "flaky-fails" if it passes some runs and fails others, and the report shows it separately.

---

## 5. CI Gate

| Trigger | What runs | Blocks merge when |
| :--- | :--- | :--- |
| Every pull request | Retrieval suite (deterministic, cheap) | Recall@5 drops below the baseline |
| Pull requests that change `packages/graphs/**`, `systemPrompts.ts`, `getModel.ts` or `retrieval/**` | All suites | Any suite drops more than 5 points below the saved baseline, **or** any injection or action-safety case fails |
| Nightly on `main` | All suites, full repeat count | Never blocks. Updates the trend report and opens an issue on regression. |

**Cost control:** the full suite should cost under $1 per run. The report prints the actual cost from `model_usage`, so cost growth is visible.

---

## 6. Non-goals
- Human-rated evaluation at scale (feedback in Spec 09 covers human signal).
- Load or performance testing (separate concern).
- Benchmarking many models against each other. The harness tests the configured model pair.

## 7. Failure Cases

| Failure | Expected behavior |
| :--- | :--- |
| OpenRouter is down during CI | Mark the evaluation job as "errored" (not "failed") and don't block the merge for infrastructure problems. Retry once. |
| Judge model output can't be parsed | Count it as a judge error, re-ask once, and report it separately from real failures. |
| Baseline file missing | The first run creates the baseline, and the gate only applies from then on. |

## 8. Acceptance Criteria
- [ ] `pnpm eval` runs all suites locally against seeded data and prints a score table.
- [ ] Each suite has at least the starting number of cases listed in section 3.
- [ ] A deliberately broken prompt (for example, removing the "cite your sources" instruction) causes the CI gate to fail on the groundedness suite.
- [ ] Every injection case is checked on every relevant pull request, and one failure blocks the merge.
- [ ] Each run report includes the total LLM cost and the p50/p95 latency per suite.
