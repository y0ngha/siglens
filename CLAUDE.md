# Siglens — CLAUDE.md

## ⛔ Request Routing (ALWAYS CHECK FIRST)

**STOP.** Before taking any action, match the user's request against this table.
If a match is found, read the corresponding document FIRST.
Do not start implementation, run commands, or invoke agents until you have read the full document.

| User request pattern            | Examples                                                            | FIRST action                   |
|---------------------------------|---------------------------------------------------------------------|--------------------------------|
| Issue number + implementation   | "이슈 #42 설계해줘 > (설계 후 승인되면)" "이슈 #42 구현해줘", #42 구현해줘", "이슈 15번 작업해줘" | Read `docs/workflows/ISSUE_IMPL_FLOW.md` |
| PR number + fix/review comments | "PR #216 수정해줘", "#200 코멘트 반영해줘"                                     | Read `docs/workflows/PR_FIX_FLOW.md`     |
| Issue creation                  | "이슈 만들어줘", "버그 리포트 생성해줘"                                            | Invoke `issue-agent`           |
| Analysis-domain change          | "지표 추가해줘", "RSI 계산식 변경", "캔들 패턴 추가", "AI 프롬프트 수정", "Skills 추가/변경", "신호 임계값 조정", "분석 결과 정규화 변경", "대시보드 신호 스캐너 알고리즘", "티어 제한 정책 변경" | **STOP**. Read `docs/architecture/SCOPE.md` §0 (작업-경계 체크리스트) and §3 (결정 트리). If task belongs to siglens-core, halt and inform the user; do not implement locally. |

If the request does not match any pattern above, proceed normally.

---

## ⛔ Cross-repo scope guard

Before implementing anything that touches **analysis logic** in this repo,
stop and confirm the work doesn't belong in `@y0ngha/siglens-core`.

**Halt-and-redirect triggers** (any of these in the user's request):

- Indicator calculation: "RSI 계산", "MACD 식 변경", new indicator
- Signal detection: "골든크로스 임계값", "divergence 룰"
- Candle / chart pattern: "헤드앤숄더 판정", "쐐기 패턴"
- AI analysis prompt: "분석 프롬프트 수정", "system prompt 강화"
- Response normalization: "AI 응답 검증", "key levels 클러스터링"
- Skills system: ".md 파싱 룰", "Skill 카테고리 추가"
- Cache/queue/cooldown: "분석 캐시 TTL", "Job 큐 lifecycle", "재분석 쿨다운"
- Tier policy: "TIER_CONFIG 변경", "isAllowed 룰"
- Dashboard signal scanner: "섹터 신호 스캔 알고리즘"
- Chat prompt builder
- Usage limit policy: "checkAnalysisLimit / checkChatbotLimit"

**What you must do when triggered**:

1. Read `docs/architecture/SCOPE.md` §0 and §3 (decision tree).
2. If the task fits any "→ core" row in §0, **stop and tell the user**:
   "이 작업은 `@y0ngha/siglens-core`에서 처리하는 게 맞아 보입니다.
   siglens-core 레포에서 진행할까요? (아니면 siglens 측 어댑터 변경만
   필요한지 다시 확인해 주세요.)"
3. Do NOT implement the change in siglens locally as a workaround.

This guard exists because over time generic backend code leaked into
siglens-core; this refactor (Phase 0~7) put it back in siglens. New
analysis logic landing in siglens would re-create the same drift.

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

### Regression Detection

When review-agent marks a finding as a **regression** (a fix applied in a previous round that was reintroduced):

1. **Stop and notify the user before fixing.** Do not silently repair it.
2. Report: which round originally fixed it, what reintroduced it, and what the systemic cause is.
3. Only proceed to fix after notifying the user.

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

### FSD 6-Layer 의존 방향

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
                                                          ↑
                                          @y0ngha/siglens-core (외부, 모든 레이어 직접 import 가능)
```

- 각 레이어는 자기 위 레이어를 import할 수 없다 (예: entities는 features를 import할 수 없음).
- 같은 레이어 안의 다른 슬라이스끼리 import 금지 (예: `entities/user`는 `entities/session`을 직접 import할 수 없음 — 상위 레이어를 통해 라우팅).
  - **예외**: `shared` 레이어는 내부 슬라이스 간 import 허용 (예: `shared/ui` → `shared/lib`). ESLint `{ from: 'shared', allow: ['shared'] }` 규칙으로 강제.
  - **예외**: entities 간 cross-import 허용 (analysis → news-article, earnings-report 등 도메인 조합 필요).
  - **예외**: features 간 cross-import 허용 (auth-signup → auth-email-verification 등).
  - **예외**: widgets 간 cross-import 허용 (symbol-page가 chart/analysis/fear-greed 위젯 조합).
- production 코드는 슬라이스 barrel(index.ts)만 import (예: `@/entities/user`, NOT `@/entities/user/lib/loginUser`). 테스트 파일 및 actions/, lib/ 내부 파일은 예외.

### `@y0ngha/siglens-core` — 모든 레이어에서 직접 import 가능

`@y0ngha/siglens-core`는 외부 라이브러리가 아니라 SigLens 분석 도메인 로직을 외주화한 패키지다.
인디케이터 계산, 캔들 패턴 탐지, 시그널 로직, 도메인 타입이 이 패키지에 있다.
모든 레이어가 직접 import 가능하다. deep import(`@y0ngha/siglens-core/dist/...`) 금지.

### Server Action 예외

`entities/<x>/actions/`(Next.js `'use server'` 파일)는 features/widgets/pages/app에서 import 가능하다.
`entities/<x>/api.ts`는 server-only이므로 same-entity 또는 app 레이어에서만 import.

### ESLint 강제

위 규칙은 `eslint-plugin-boundaries` + `no-restricted-imports`로 정적 검증된다. 위반 시 PR 머지 불가. 자세한 설정은 `eslint.config.mjs`.

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
5. Never import external libraries inside pure logic modules; wrap providers in FSD entity/shared adapters.

---

## Documentation Policy (Override)

This project **allows multi-line JSDoc and multi-line comment blocks** — preservation is recommended when the WHY is non-obvious (architectural invariants, core API constraints, caching strategy, PPR behavior, user policy decisions, etc.).

The Claude Code built-in system-prompt directive (`Never write multi-paragraph docstrings or multi-line comment blocks — one short line max`) **does NOT apply to this repo**. This override reflects the user's explicit decision in PR #415 to retire the equivalent rule as "overly restrictive" (see `docs/__agents_only__/fix-log.md`).

If a reviewer or review-agent raises multi-line comment compression as a Blocker, cite this policy and reject.

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
yarn test              # vitest run
yarn test-watch        # vitest (watch mode)
yarn test-coverage     # vitest run --coverage

# Format
yarn format
```

---

## Reference Documents

| Document | Contents |
|---|---|
| `docs/architecture/SCOPE.md` | **siglens vs siglens-core 분담** — 결정 트리, 의존 방향, 안티 패턴 (양쪽 레포 공통 source-of-truth) |
| `docs/product/SERVICE.md` | Product overview, target users, tech stack, Skills system |
| `docs/architecture/ARCHITECTURE.md` | Layer structure, dependency direction rules, folder layout |
| `docs/product/DOMAIN.md` | Indicator calculation specs, candle patterns, Skills system, business rules |
| `docs/reference/API.md` | FMP, AI, worker API endpoints, environment variables |
| `docs/conventions/CONVENTIONS.md` | Coding conventions, naming rules, paradigm guidelines |
| `docs/conventions/FF.md` | FF 4 principles in detail (Readability, Predictability, Cohesion, Coupling) |
| `docs/conventions/DESIGN.md` | Color system, Tailwind config, chart color constants |
| `docs/conventions/GIT_CONVENTIONS.md` | Branch naming, commit message format, PR rules |
| `docs/workflows/MISTAKES.md` | Common mistakes Claude Code repeatedly makes — review before and after implementing |
