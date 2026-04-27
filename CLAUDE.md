# Siglens — CLAUDE.md

## ⛔ Request Routing (ALWAYS CHECK FIRST)

**STOP.** Before taking any action, match the user's request against this table.
If a match is found, read the corresponding document FIRST.
Do not start implementation, run commands, or invoke agents until you have read the full document.

| User request pattern            | Examples                                                            | FIRST action                   |
|---------------------------------|---------------------------------------------------------------------|--------------------------------|
| Issue number + implementation   | "이슈 #42 설계해줘 > (설계 후 승인되면)" "이슈 #42 구현해줘", #42 구현해줘", "이슈 15번 작업해줘" | Read `docs/ISSUE_IMPL_FLOW.md` |
| PR number + fix/review comments | "PR #216 수정해줘", "#200 코멘트 반영해줘"                                     | Read `docs/PR_FIX_FLOW.md`     |
| Issue creation                  | "이슈 만들어줘", "버그 리포트 생성해줘"                                            | Invoke `issue-agent`           |

If the request does not match any pattern above, proceed normally.

---

## Role & Constraints

You are the **main orchestrator**. You directly implement code and fix PRs, while delegating review, git operations, and other auxiliary tasks to sub-agents.

**Prohibited actions:**
- ❌ Creating commits or pushing (git-agent's responsibility)
- ❌ Skipping the review-agent step after implementation

**Language rules:**
- When prompting sub-agents: always use **English**
- Sub-agent output: always in **English**
- When reporting or summarizing to the user: always use **Korean**

**Trust exit signals — never override routing based on output appearance:**
When a sub-agent returns `status: done`, always follow the routing table regardless of how detailed or minimal the output looks. If the output seems sparse or lacking detail, that is not a reason to intervene directly. Route to the next agent as defined.

---

## Agent System

### Sub-agents

Specialized sub-agents are defined in `.claude/agents/`. Each agent has a distinct responsibility
and must not perform work outside its scope.
Sub-agents do not call each other — you invoke them one at a time.
**Never ask the user for confirmation between steps — route automatically.**

| Agent | Model  | Responsibility |
|---|---|---|
| `review-agent` | Sonnet | Code review — returns findings only, never modifies code |
| `mistake-managing-agent` | Haiku  | Reads docs/__agents_only__/fix-log.md, promotes recurring violations to MISTAKES.md |
| `git-agent` | Haiku  | Commits, pushes, PR creation — never modifies code |
| `issue-agent` | Haiku  | Creates GitHub issues using the appropriate template — never modifies code |

### Exit Signal Routing Table

When you receive an exit signal, route as follows:

| Signal | Route to |
|---|---|
| Implementation complete | Invoke `review-agent` |
| `review-agent` · `status: approved` | Invoke `mistake-managing-agent` |
| `review-agent` · `status: changes_requested` | **You** fix the findings directly, then re-invoke `review-agent` |
| `review-agent` · `status: loop_limit_reached` | Stop — report to user |
| PR fix complete | Invoke `mistake-managing-agent` (skip review-agent) |
| `mistake-managing-agent` · `status: done` | Invoke `git-agent` |
| `git-agent` · `status: done` | Stop — report result to user |
| Any · `status: failed` | Stop — report failure reason to user |

### Handling Findings

When review-agent returns findings, fix both `required` and `recommended` findings directly.

**Skip a finding only if it is:**
- A false positive — the code is correct and the concern does not apply in context
- Too trivial to justify a fix — e.g. minor comment wording with no functional or readability impact

All other findings should be fixed. When in doubt, fix it.

If **all** findings (required and recommended) are skipped, proceed directly to `mistake-managing-agent`.

### Invoking review-agent (Round 2+)

review-agent runs in an independent context each round — it has no memory of previous rounds.
To prevent redundant re-reading of already-reviewed files, pass the previous round's findings when invoking round 2 or later:

```
Review the code on branch {branch}. This is round {N}.

Previous round findings (already fixed):
{previous findings JSON}

modified_files (files changed in this fix round):
{list of file paths you edited}

Focus only on modified_files above.
Do not re-review files that were already approved in the previous round.
```

This ensures review-agent only reads the files that were actually modified in the fix round, not the full diff against master.

### Exit Signal Contract

Every sub-agent ends its response with a JSON exit signal and nothing else.

```json
// review-agent — approved
{ "agent": "review-agent", "status": "approved" }

// review-agent — findings exist
{ "agent": "review-agent", "status": "changes_requested", "round": 1, "findings": { "required": [...], "recommended": [...] } }

// review-agent — loop limit reached
{ "agent": "review-agent", "status": "loop_limit_reached", "round": 3, "message": "..." }

// mistake-managing-agent — success
{ "agent": "mistake-managing-agent", "status": "done", "promoted": 2 }

// mistake-managing-agent — failure
{ "agent": "mistake-managing-agent", "status": "failed", "reason": "..." }

// git-agent — new PR created
{ "agent": "git-agent", "status": "done", "action": "pr_created", "pr_url": "..." }

// git-agent — existing PR updated
{ "agent": "git-agent", "status": "done", "action": "pr_updated", "pr": 23 }

// git-agent — failure
{ "agent": "git-agent", "status": "failed", "reason": "..." }
```

---

## Layer Dependency Rules (Never Violate)

```
domain         ← No external imports. Pure TypeScript functions only.
                 Exception: @y0ngha/siglens-core may be imported (see below).
infrastructure ← May import from domain only. Handles file I/O (Skills) and API calls.
lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). Pure functions only.
app (RSC/Route)← May import from infrastructure, domain, lib.
components     ← May import from domain, lib.
               Component files (.tsx): Direct imports from infrastructure are prohibited.
               Hook files (hooks/): May import fetch functions from infrastructure only
                 → Limited to queryFn/mutationFn connection purpose
                 → Type imports must be from @/domain/types or @y0ngha/siglens-core

lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). Pure functions only.
               May import types from domain (e.g. Timeframe) when needed for React Query key factories.
               React Query key factories (QUERY_KEYS) and config constants belong in lib/.
```

**`@y0ngha/siglens-core` exception**: This package is not a third-party library — it is the externalized SigLens domain logic (indicators, candle patterns, signals, domain types). Direct import is allowed from **every layer** including `components/` and hooks. Do not create thin re-export wrappers in `domain/` — they are pure boilerplate. Deep imports (`@y0ngha/siglens-core/dist/...`) are still prohibited; use only the public package surface. Local `src/domain/` keeps only SigLens-app-specific logic (backtest, chat models, dashboard sector grouping, etc.).

Violations trigger ESLint errors. PRs cannot be merged.

---

## Skill Usage Rules

Invoke the listed skills **before** writing code in each category. Do not skip.

| Situation | Skills to invoke (in order)                               |
|---|-----------------------------------------------------------|
| New feature (any kind) | `brainstorming` first — no exceptions                     |
| UI component / page implementation | `frontend-design` → `web-design-guidelines` → `seo-audit` |
| React / Next.js code | `vercel-react-best-practices` → `next-cache-components`   |
| Pure functions / business logic / TypeScript types | `typescript-advanced-types`, `typescript-expert`                             |

**Rules:**
- `brainstorming` is mandatory before any new feature, regardless of size.
- UI skills apply whenever a `.tsx` component or page is being created or significantly modified.
- React/Next.js skills apply whenever you write hooks, RSC, route handlers, or data-fetching logic.
- TypeScript skills apply whenever you define types, generics, or domain-layer pure functions.

---

## Task Execution Rules

1. Read the relevant `docs/` documents before starting any task.
2. Define interfaces (`types.ts`) before writing implementations.
3. Always write test files alongside implementation files.
4. Never violate layer dependency directions.
5. Never import external libraries inside `domain/`.

---

## Commands

Always use `yarn` for package installation. `npm` and `pnpm` are prohibited.

```bash
# Dev server (port 4200)
yarn dev

# Build
yarn build

# Lint
yarn lint
yarn lint:fix
yarn lint:style
yarn lint:style-fix

# Test
yarn test
yarn test-watch
yarn test-coverage
yarn test-coverage-watch
yarn test-coverage-report

# Format
yarn format
```

---

## Reference Documents

| Document | Contents |
|---|---|
| `docs/SERVICE.md` | Product overview, target users, tech stack, Skills system |
| `docs/ARCHITECTURE.md` | Layer structure, dependency direction rules, folder layout |
| `docs/DOMAIN.md` | Indicator calculation specs, candle patterns, Skills system, business rules |
| `docs/API.md` | Alpaca and Claude API endpoints, request/response schemas |
| `docs/CONVENTIONS.md` | Coding conventions, naming rules, paradigm guidelines |
| `docs/FF.md` | FF 4 principles in detail (Readability, Predictability, Cohesion, Coupling) |
| `docs/DESIGN.md` | Color system, Tailwind config, chart color constants |
| `docs/GIT_CONVENTIONS.md` | Branch naming, commit message format, PR rules |
| `docs/MISTAKES.md` | Common mistakes Claude Code repeatedly makes — review before and after implementing |
