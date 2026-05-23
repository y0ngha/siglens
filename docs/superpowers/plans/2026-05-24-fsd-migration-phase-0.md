# FSD Migration — Phase 0 (준비) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layered → FSD 마이그레이션의 Phase 0 (안전망 준비)을 완료한다. 이 PR들이 머지되면 Phase 1~9 동안 master 빌드/배포가 깨지지 않으며, 모든 자동화(ESLint, Jest, CI 리뷰, sub-agent)가 옛 + 새 layer를 동시에 인식한다.

**Architecture:** 3개 PR로 분할 — (1) Config 변경 (ESLint boundaries + tsconfig paths + Jest coverage + no-restricted-imports), (2) Workflow/Sub-agent path-agnostic 재설계, (3) Spec + CLAUDE.md 머지. 각 PR은 독립적으로 검증되고 머지된다. 새 layer 디렉토리는 비어 있는 상태로 두어 boundaries 위반이 자연 0으로 통과한다.

**Tech Stack:** ESLint 9 + eslint-plugin-boundaries, TypeScript 5 + Next.js paths, Jest 30 + ts-jest, husky pre-push hook, GitHub Actions(claude-code-action@v1), Claude Code sub-agents.

**참고 spec:** `docs/superpowers/specs/2026-05-24-fsd-migration-design.md`

**Scope 노트:** 본 plan은 **Phase 0만** 다룬다. Phase 1~9는 각각 별도 plan으로 작성한다 (예: `2026-05-25-fsd-migration-phase-1.md`).

**Git/PR 정책:** siglens `CLAUDE.md` 정책에 따라 main orchestrator는 commit/push/PR 생성을 직접 수행하지 않는다. 각 PR의 "커밋 + PR 생성" 단계에서 `git-agent` sub-agent에 위임한다.

---

## PR 1 — Config 변경 묶음

ESLint boundaries 도입, tsconfig paths alias 확장, jest coverage threshold 완화, no-restricted-imports 도입을 한 PR로 묶는다. 이유: 4가지 모두 root 설정 파일 변경이며 서로 의존(예: boundaries가 인식할 수 있도록 tsconfig alias가 먼저 정의되어야 함). PR 분리 시 임시로 빌드 깨지는 시점이 발생.

### Task 1.1: `eslint-plugin-boundaries` devDependency 추가

**Files:**
- Modify: `package.json` (devDependencies 추가)

- [ ] **Step 1: 현 devDependencies 확인**

Run: `grep -n '"eslint' /Users/y0ngha/Project/siglens/package.json`

Expected output:
```
"eslint": "^9",
"eslint-config-next": "16.2.0",
```

- [ ] **Step 2: 패키지 설치**

Run: `cd /Users/y0ngha/Project/siglens && yarn add -D eslint-plugin-boundaries`

Expected output: `eslint-plugin-boundaries`가 devDependencies에 추가되고 yarn.lock 갱신.

- [ ] **Step 3: 설치 확인**

Run: `grep -n '"eslint-plugin-boundaries' /Users/y0ngha/Project/siglens/package.json`

Expected: 한 줄 출력. 버전은 `^5` 또는 그 이상.

- [ ] **Step 4: 다음 task로 진행 (커밋은 PR 1 끝에서 일괄)**

---

### Task 1.2: `tsconfig.json` paths alias 확장

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/tsconfig.json` (paths 섹션)

- [ ] **Step 1: 현 paths 섹션 확인**

Read `tsconfig.json`. 현재는 `"@/*": ["./src/*"]` 만 있음.

- [ ] **Step 2: paths 섹션 갱신**

`paths` 객체를 다음과 같이 교체:

```json
"paths": {
    "@/*": ["./src/*"],
    "@/widgets/*": ["./src/widgets/*"],
    "@/features/*": ["./src/features/*"],
    "@/entities/*": ["./src/entities/*"],
    "@/pages/*": ["./src/pages/*"]
}
```

기존 `@/*`는 그대로 두고 새 4개 alias를 추가한다. `@/shared/*`는 별도 등록 불필요 — `@/*`가 `./src/*`로 매핑되므로 `@/shared/foo`는 자동으로 `./src/shared/foo`로 해석된다.

- [ ] **Step 3: typecheck 통과 확인**

Run: `cd /Users/y0ngha/Project/siglens && yarn typecheck`

Expected: `tsc --noEmit`이 에러 0으로 완료. 새 alias가 등록되었지만 실제 디렉토리는 비어 있어 미사용 → 영향 없음.

- [ ] **Step 4: 다음 task로 진행**

---

### Task 1.3: `eslint.config.mjs`에 boundaries + no-restricted-imports 추가

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/eslint.config.mjs`

- [ ] **Step 1: 현 eslint.config.mjs 확인**

Read 파일. 구조 확인:
- `defineConfig`로 export
- `...nextVitals`, `...nextTs` 펼침
- `globalIgnores` 사용
- 마지막에 `'@typescript-eslint/no-unused-vars'` 규칙

- [ ] **Step 2: boundaries plugin import 추가**

파일 최상단 import 섹션에 추가:

```js
import boundaries from 'eslint-plugin-boundaries';
```

기존 import 3개(`defineConfig`, `nextVitals`, `nextTs`) 바로 아래.

- [ ] **Step 3: boundaries 설정 블록 추가**

`eslintConfig` 배열의 마지막 객체 다음(`'@typescript-eslint/no-unused-vars'` 블록 다음)에 boundaries 설정 객체를 추가:

```js
{
    plugins: { boundaries },
    settings: {
        'boundaries/elements': [
            // 새 FSD layer (현재 디렉토리 비어 있음)
            { type: 'app', pattern: 'src/app/**' },
            { type: 'pages', pattern: 'src/pages/*' },
            { type: 'widgets', pattern: 'src/widgets/*' },
            { type: 'features', pattern: 'src/features/*' },
            { type: 'entities', pattern: 'src/entities/*' },
            { type: 'shared', pattern: 'src/shared/**' },
            // 옛 layer (Phase 1~9 동안 점진 제거)
            { type: 'legacy-app', pattern: 'src/app/**' },
            { type: 'legacy-comp', pattern: 'src/components/**' },
            { type: 'legacy-domain', pattern: 'src/domain/**' },
            { type: 'legacy-infra', pattern: 'src/infrastructure/**' },
            { type: 'legacy-lib', pattern: 'src/lib/**' },
        ],
    },
    rules: {
        'boundaries/element-types': [
            'error',
            {
                default: 'disallow',
                rules: [
                    { from: 'app', allow: ['pages', 'widgets', 'features', 'entities', 'shared', 'legacy-comp', 'legacy-domain', 'legacy-infra', 'legacy-lib'] },
                    { from: 'pages', allow: ['widgets', 'features', 'entities', 'shared', 'legacy-comp', 'legacy-domain', 'legacy-infra', 'legacy-lib'] },
                    { from: 'widgets', allow: ['features', 'entities', 'shared', 'legacy-comp', 'legacy-domain', 'legacy-infra', 'legacy-lib'] },
                    { from: 'features', allow: ['entities', 'shared', 'legacy-domain', 'legacy-infra', 'legacy-lib'] },
                    { from: 'entities', allow: ['shared', 'legacy-domain', 'legacy-infra', 'legacy-lib'] },
                    { from: 'shared', allow: ['shared'] },
                    // 옛 layer 간 의존: 현재 코드 그대로 허용
                    { from: 'legacy-app', allow: ['legacy-comp', 'legacy-domain', 'legacy-infra', 'legacy-lib', 'shared'] },
                    { from: 'legacy-comp', allow: ['legacy-domain', 'legacy-infra', 'legacy-lib', 'shared'] },
                    { from: 'legacy-domain', allow: ['legacy-lib', 'shared'] },
                    { from: 'legacy-infra', allow: ['legacy-domain', 'legacy-lib', 'shared'] },
                    { from: 'legacy-lib', allow: ['legacy-domain', 'shared'] },
                ],
            },
        ],
    },
}
```

> `legacy-app`/`app` 둘 다 `src/app/**` 패턴을 공유한다 — boundaries plugin은 동일 파일에 두 type을 허용하지 않을 수 있다. 이 경우 boundaries elements에서 `legacy-app` 행을 제거하고 `from: 'app'` 의 allow 목록에 `legacy-*` 들을 포함한 그대로 둔다 (이미 그렇게 작성됨). 검증 단계에서 `yarn lint`로 충돌 여부 확인.

- [ ] **Step 4: no-restricted-imports 설정 블록 추가**

위 boundaries 블록 다음에 또 다른 객체를 추가:

```js
{
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
    rules: {
        'no-restricted-imports': [
            'error',
            {
                patterns: [
                    '@/features/*/model/*',
                    '@/features/*/hooks/*',
                    '@/features/*/ui/*',
                    '@/features/*/lib/*',
                    '@/features/*/api/*',
                    '@/widgets/*/ui/*',
                    '@/widgets/*/hooks/*',
                    '@/widgets/*/lib/*',
                    '@/entities/*/api',
                    '@/entities/*/api/*',
                    '@/entities/*/model',
                    '@/entities/*/lib',
                    '@/entities/*/lib/*',
                ],
            },
        ],
    },
},
```

`@/entities/*/actions`는 패턴에서 의도적으로 제외 — Next.js `'use server'` 파일은 client에서 import 가능해야 한다.

- [ ] **Step 5: yarn lint 통과 확인**

Run: `cd /Users/y0ngha/Project/siglens && yarn lint`

Expected: 에러 0. 새 layer 디렉토리(`widgets/`, `features/`, `entities/`, `pages/`)는 비어 있어 boundaries 위반 발생하지 않음. `no-restricted-imports`는 새 layer 디렉토리가 비어 있어 매칭되는 import 0.

만약 boundaries plugin이 `legacy-app`와 `app` 패턴 중복을 거부하면:
1. boundaries elements에서 `{ type: 'legacy-app', pattern: 'src/app/**' }` 행을 삭제
2. `{ from: 'legacy-app', ... }` 규칙 행도 함께 삭제
3. `from: 'app'` 의 allow 목록은 그대로 유지 (이미 legacy-* 포함)
4. 다시 `yarn lint` 실행

- [ ] **Step 6: 다음 task로 진행**

---

### Task 1.4: `jest.config.js` 갱신

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/jest.config.js`

- [ ] **Step 1: 현 jest.config.js 확인**

Read 파일. 현재:
- `testMatch: ['<rootDir>/src/__tests__/**/*.+(test|spec).+(ts|tsx)']`
- `collectCoverageFrom: ['src/domain/**/*.ts', 'src/infrastructure/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts', '!src/**/types.ts']`
- `coverageThreshold.global: { branches: 100, functions: 100, lines: 100, statements: 100 }`

- [ ] **Step 2: testMatch 확장**

`testMatch` 배열을 다음과 같이 교체:

```js
testMatch: [
    '<rootDir>/src/__tests__/**/*.+(test|spec).+(ts|tsx)',
    '<rootDir>/src/**/__tests__/**/*.+(test|spec).+(ts|tsx)',
],
```

옛 미러(`src/__tests__/`) + 새 colocate(`src/<layer>/<slice>/__tests__/`) 둘 다 허용. 두 번째 패턴은 첫 번째와 중첩되지만 jest는 자동으로 중복 파일을 한 번만 실행한다.

- [ ] **Step 3: collectCoverageFrom 확장**

`collectCoverageFrom` 배열을 다음과 같이 교체:

```js
collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/infrastructure/**/*.ts',
    'src/entities/**/*.ts',
    'src/features/**/lib/**/*.ts',
    'src/features/**/api/**/*.ts',
    'src/shared/lib/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/types.ts',
],
```

옛 + 새 둘 다 매칭. 옛 디렉토리가 비어지면 자동으로 collect 대상이 0이 되므로 atomic move 진행 중 안전.

- [ ] **Step 4: coverageThreshold 완화**

`coverageThreshold.global` 객체를 다음과 같이 교체:

```js
coverageThreshold: {
    global: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
    },
},
```

100 → 90. 비즈니스 로직에 억지 테스트 부담 감소.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd /Users/y0ngha/Project/siglens && yarn test:quiet`

Expected: 모든 테스트 통과. 현재 100% coverage는 90% threshold를 자연 통과. `domain/`, `infrastructure/`만 측정.

만약 누락 테스트로 실패하면 그 자체가 발견이지만, 현 master는 통과하는 상태이므로 정상적으로 통과해야 함. 실패 시 jest config 변경에 오타 없는지 점검.

- [ ] **Step 6: 다음 task로 진행**

---

### Task 1.5: PR 1 검증 + 커밋 + PR 생성

**Files:** 본 PR에 포함된 모든 변경 파일 검증

- [ ] **Step 1: 변경 파일 목록 확인**

Run: `cd /Users/y0ngha/Project/siglens && git status -s`

Expected:
```
M eslint.config.mjs
M jest.config.js
M package.json
M tsconfig.json
M yarn.lock
```

5개 파일.

- [ ] **Step 2: 전체 검증 (husky pre-push 시뮬레이션)**

병렬 실행:
```bash
cd /Users/y0ngha/Project/siglens
yarn format:check &
yarn lint &
yarn typecheck &
yarn test:quiet &
wait
```

Expected: 4개 모두 exit 0.

각각 실패 시:
- `format:check` 실패 → `yarn format` 실행 후 재시도
- `lint` 실패 → Task 1.3 Step 5 트러블슈팅 참고
- `typecheck` 실패 → tsconfig.json paths 오타 점검
- `test:quiet` 실패 → jest.config.js 오타 점검

- [ ] **Step 3: 새 branch 생성 + 커밋 + PR 생성 (git-agent 위임)**

`git-agent` sub-agent를 호출하여 다음을 수행:
- branch 생성: `refactor/fsd-phase-0-config`
- 변경 파일 5개 스테이지 + 커밋
- 커밋 메시지: `refactor(arch): Phase 0 — ESLint boundaries, tsconfig paths, jest coverage 90%`
- 커밋 body:
  ```
  - eslint-plugin-boundaries 도입, 옛 + 새 layer 사전 등록 (위반 0 유지)
  - tsconfig paths alias: @/widgets, @/features, @/entities, @/pages
  - jest coverageThreshold 100 → 90, collectCoverageFrom + testMatch 옛/새 둘 다 매칭
  - no-restricted-imports로 slice internal path 차단, @/entities/*/actions 예외

  Phase 0 of FSD migration. See docs/superpowers/specs/2026-05-24-fsd-migration-design.md
  ```
- push + `gh pr create`로 PR 생성
- PR 제목: `refactor(arch): Phase 0 — FSD migration config setup`
- PR body에 spec 링크 + 본 plan 링크 + 변경 요약 + Test plan 체크리스트

- [ ] **Step 4: PR URL 확인 + 리뷰 대기**

git-agent가 반환한 PR URL을 기록. claude-code-review.yml이 자동으로 PR 리뷰를 시작한다. 머지 전까지 PR 2 진행 보류 (PR 2가 PR 1의 ESLint 규칙에 의존하지는 않지만, 순차 머지로 충돌 최소화).

---

## PR 2 — Workflow + Sub-agent path-agnostic 재설계

GitHub Actions 워크플로우와 Claude Code sub-agent들의 path 의존 conditional doc loading을 일반화한다. PR 1이 머지된 후 진행.

### Task 2.1: `claude-code-review.yml` 재설계

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/.github/workflows/claude-code-review.yml`

- [ ] **Step 1: 현 prompt 구조 확인**

파일을 다시 읽어 다음 섹션 위치 파악:
- `## Review Procedure & Agentic Flow` (line 70 부근)
- `3. **Contextual Reading**: Based on the diff, read CLAUDE.md, /docs/MISTAKES.md, and ONLY the relevant principle documents from the list below.` — 이 문장이 핵심
- `## Project Principle Documents (Reference Pool)` 섹션 — docs 목록

- [ ] **Step 2: Contextual Reading 단계를 path-agnostic으로 갱신**

`3. **Contextual Reading**: ...` 문장을 다음으로 교체:

```
3. **Contextual Reading**: Always read the following core documents:
   - CLAUDE.md
   - docs/MISTAKES.md (highest priority — known repeated patterns)
   - docs/ARCHITECTURE.md
   - docs/CONVENTIONS.md
   - docs/FF.md
   
   Additionally read **only** the documents relevant to the changed files:
   - If the diff touches indicator calculations, signal logic, or candle patterns → read docs/DOMAIN.md
   - If the diff touches UI components (.tsx files) → read docs/DESIGN.md
   - If the diff touches external API integrations (AI providers, market data) → read docs/API.md
   - If the diff touches authentication flows or session management → read docs/AUTH.md
   - If the diff touches FSD layer boundaries or cross-layer imports → read the relevant src/<layer>/CLAUDE.md (if it exists)
   
   Do NOT use concrete directory paths (src/domain/, src/infrastructure/) as triggers — those layers are being migrated to FSD and may not exist mid-migration. Use file content / responsibility as the trigger instead.
```

이 표현은 layer 이름이 사라져도 review-agent가 적절한 docs를 로드할 수 있게 한다.

- [ ] **Step 3: Review Focus Areas 갱신**

`## Review Focus Areas` 섹션에서 layer 이름이 박힌 항목 점검:
- "Layer dependencies: Import direction violations (ARCHITECTURE.md)" — 유지 (ARCHITECTURE.md 자체가 갱신될 것)
- "Domain rules: Purity, null handling, return types (DOMAIN.md)" — 유지
- 나머지는 layer 이름이 박혀 있지 않으므로 유지

- [ ] **Step 4: workflow 문법 검증**

`yamllint` 미설치 가능. 대신 GitHub Actions UI에 노출되는 yaml 구조가 깨지지 않았는지 시각적으로 확인 — 들여쓰기 일관성, `|` 다음 prompt block의 들여쓰기 유지.

- [ ] **Step 5: 다음 task로 진행**

---

### Task 2.2: `.claude/agents/review-agent.md` 재설계

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/.claude/agents/review-agent.md`

- [ ] **Step 1: 현 review-agent.md의 "Load Required Documents" 섹션 확인**

`### 2. Load Required Documents` 섹션을 찾는다. 현재:

```markdown
| Condition | Also read |
|---|---|
| `src/domain/` changed (excluding `__tests__/` only changes) | `docs/DOMAIN.md` |
| `src/components/*.tsx` changed | `docs/DESIGN.md` |
| `src/infrastructure/ai/` or `src/infrastructure/market/` changed | `docs/API.md` |
| Only `src/__tests__/` files changed, no source files | Skip all conditional docs |
```

이 표가 path 의존.

- [ ] **Step 2: 표를 path-agnostic 표현으로 교체**

위 표를 다음과 같이 교체:

```markdown
| Condition | Also read |
|---|---|
| Diff touches indicator calculations, signal logic, candle patterns, or prompt builders | `docs/DOMAIN.md` |
| Diff touches `.tsx` files (UI components) | `docs/DESIGN.md` |
| Diff touches AI provider calls or market data fetches | `docs/API.md` |
| Diff touches authentication flows or session management | `docs/AUTH.md` |
| Only test files changed, no source files | Skip all conditional docs |

Determine the trigger by reading the actual file content of the diff — do NOT match on directory paths (`src/domain/`, `src/infrastructure/`). FSD migration is in progress; concrete layer paths are unstable.
```

- [ ] **Step 3: Excluded Directories 섹션 확인**

`### Excluded Directories` 섹션의 path 목록 (line 70~80 부근):
```
/docs/**
/refs/**
/public/**
/.github/**
/.yarn/**
/.agents/**
/.claude/**
```

이 목록은 path 그대로 두는 게 맞다 — 이건 "리뷰 대상에서 제외할 절대 경로" 목록이라 layer 이동과 무관. 변경 없음.

- [ ] **Step 4: Siglens Rule Check (Checklist) 섹션 점검**

`### Step 1. Siglens Rule Check (Checklist)` 의 항목들 점검:
- `domain/: no external library imports (technicalindicators, lodash, etc.)` — layer 이름 박힘
- `components/: no direct imports from infrastructure` — layer 이름 박힘
- `Lightweight Charts is not imported outside components/chart/` — 박힘

이 항목들은 옛 layer 동안 유효하므로 그대로 둠. Phase 9에서 FSD 전환 완료 시 갱신.

대신 본 task의 변경은 "Load Required Documents" 표만 path-agnostic화 → checklist는 옛 layer가 살아 있는 동안 유효한 그대로.

- [ ] **Step 5: 다음 task로 진행**

---

### Task 2.3: 나머지 sub-agent 점검 + flow docs 갱신

**Files:**
- Read+Modify: `/Users/y0ngha/Project/siglens/.claude/agents/mistake-managing-agent.md`
- Read+Modify: `/Users/y0ngha/Project/siglens/.claude/agents/git-agent.md`
- Read+Modify: `/Users/y0ngha/Project/siglens/.claude/agents/issue-agent.md`
- Modify: `/Users/y0ngha/Project/siglens/docs/ISSUE_IMPL_FLOW.md`
- Modify: `/Users/y0ngha/Project/siglens/docs/PR_FIX_FLOW.md`

- [ ] **Step 1: mistake-managing-agent.md 점검**

파일을 읽는다. layer-name 의존 표(`src/domain/`, `src/infrastructure/`, `src/components/` 등)가 있는지 확인.

- 발견 시: 해당 표를 review-agent.md와 동일한 방식으로 path-agnostic 표현으로 교체.
- 없으면: 변경 없음, 다음 step.

- [ ] **Step 2: git-agent.md 점검**

파일을 읽는다. git-agent는 commit/push/PR 생성 책임이라 path 의존이 낮음. 다만 PR body 템플릿이 layer 이름을 가정하는 경우가 있을 수 있음.

- 발견 시: 일반화 표현으로 교체 ("affected layer" → "affected slice/area").
- 없으면: 변경 없음.

- [ ] **Step 3: issue-agent.md 점검**

파일을 읽는다. issue 템플릿에서 layer name을 카테고리로 쓰는 경우가 있는지 확인. 

- 발견 시: 갱신.
- 없으면: 변경 없음.

- [ ] **Step 4: `docs/ISSUE_IMPL_FLOW.md` "Modified layer" 표 갱신**

파일에서 다음 표를 찾는다(Step 1-2 인근):

```
| Modified layer | MISTAKES.md sections to read |
| ... |
```

이 표를 path-agnostic 매핑으로 교체:

```markdown
| Modified area | MISTAKES.md sections to read |
|---|---|
| Indicator calculations, signal logic, candle patterns | Coding Paradigm, Domain Functions |
| UI components (.tsx) | Components |
| TypeScript type definitions | TypeScript |
| Test files | Tests |
| SEO / structured data | SEO & Semantic Markup |
| Accessibility / ARIA | Accessibility (WAI-ARIA) |
| All other changes | Coding Paradigm (general) |

Determine the area by reading the diff content — do not match on concrete directory paths (src/domain/, src/infrastructure/). FSD migration is in progress.
```

- [ ] **Step 5: `docs/PR_FIX_FLOW.md` 동일 점검**

파일 전체를 읽고 "Modified layer" 또는 유사한 path-dependent 표가 있는지 확인. 있으면 Step 4와 동일하게 교체.

- [ ] **Step 6: 다음 task로 진행**

---

### Task 2.4: PR 2 검증 + 커밋 + PR 생성

**Files:** 본 PR에 포함된 변경 파일들

- [ ] **Step 1: 변경 파일 목록 확인**

Run: `cd /Users/y0ngha/Project/siglens && git status -s`

Expected (예시):
```
M .claude/agents/git-agent.md
M .claude/agents/issue-agent.md
M .claude/agents/mistake-managing-agent.md
M .claude/agents/review-agent.md
M .github/workflows/claude-code-review.yml
M docs/ISSUE_IMPL_FLOW.md
M docs/PR_FIX_FLOW.md
```

7개 또는 그 이하 (각 sub-agent에서 path 의존이 없으면 변경 없음).

- [ ] **Step 2: 전체 검증**

병렬 실행:
```bash
cd /Users/y0ngha/Project/siglens
yarn format:check &
yarn lint &
yarn typecheck &
yarn test:quiet &
wait
```

Expected: 4개 모두 exit 0.

> 본 PR은 코드 변경이 없고 문서/yml만 변경되므로 lint/typecheck/test는 영향 없이 통과해야 함.

- [ ] **Step 3: 새 branch + 커밋 + PR 생성 (git-agent 위임)**

`git-agent` sub-agent를 호출하여:
- branch: `refactor/fsd-phase-0-workflows`
- base: master (PR 1이 머지된 상태 가정)
- 커밋 메시지: `refactor(arch): Phase 0 — workflow/sub-agent path-agnostic 재설계`
- body:
  ```
  - claude-code-review.yml: conditional doc loading을 file content/책임 기반으로 일반화
  - .claude/agents/{review,mistake-managing,git,issue}-agent.md: layer-name 의존 제거
  - docs/{ISSUE_IMPL_FLOW,PR_FIX_FLOW}.md: "Modified layer" 표 path-agnostic화

  Phase 0 of FSD migration. See docs/superpowers/specs/2026-05-24-fsd-migration-design.md
  ```
- PR 제목: `refactor(arch): Phase 0 — workflow & sub-agent path-agnostic redesign`

- [ ] **Step 4: PR URL 확인 + 리뷰 대기**

PR 2의 리뷰가 자동 시작된다. 이 PR이 머지된 후 PR 3 진행.

---

## PR 3 — Spec + CLAUDE.md 머지

본 spec(`2026-05-24-fsd-migration-design.md`)과 본 plan은 이미 작성되어 워킹 트리에 있다. `CLAUDE.md`의 Layer Dependency Rules 섹션을 FSD + legacy 공존 표현으로 갱신하고, spec/plan과 함께 한 PR로 머지한다.

### Task 3.1: `CLAUDE.md` 갱신

**Files:**
- Modify: `/Users/y0ngha/Project/siglens/CLAUDE.md`

- [ ] **Step 1: 현 CLAUDE.md의 Layer Dependency Rules 섹션 확인**

`## Layer Dependency Rules (Never Violate)` 섹션을 찾는다. 현재:

```
domain         ← No external imports. Pure TypeScript functions only.
                 Exception: @y0ngha/siglens-core may be imported (see below).
infrastructure ← May import from domain and lib (lib must be pure utilities/constants only). ...
lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). ...
app (RSC/Route)← May import from infrastructure, domain, lib.
components     ← May import from domain, lib.
               Component files (.tsx): Direct imports from infrastructure are prohibited.
               Hook files (hooks/): May import fetch functions from infrastructure only
                 ...
```

- [ ] **Step 2: Layer Dependency Rules 섹션을 FSD + legacy 공존으로 교체**

위 섹션 전체를 다음으로 교체:

```markdown
## Layer Dependency Rules (Never Violate)

### Migration in progress: Layered → FSD

본 프로젝트는 현재 **Layered 구조에서 Feature-Sliced Design (FSD) 6-layer로 단계적으로 마이그레이션 중**이다. Phase 0~9 동안 옛 layer와 새 layer가 공존한다. 자세한 설계는 `docs/superpowers/specs/2026-05-24-fsd-migration-design.md` 참고.

### FSD 의존 방향 (목표 상태)

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
                                                          ↑
                                          @y0ngha/siglens-core (외부, 모든 레이어 직접 import 가능)
```

- 각 레이어는 자기 위 레이어를 import할 수 없다 (예: entities는 features를 import할 수 없음).
- 같은 레이어 안의 다른 슬라이스끼리 import 금지 (예: `entities/user`는 `entities/session`을 직접 import할 수 없음 — 상위 레이어를 통해 라우팅).
- production 코드는 슬라이스 root만 import (예: `@/widgets/stock-chart`, NOT `@/widgets/stock-chart/ui/Chart`). 테스트 파일은 예외.

### Legacy 의존 방향 (마이그레이션 동안 유지)

```
domain         ← No external imports. Pure TypeScript functions only.
                 Exception: @y0ngha/siglens-core may be imported.
infrastructure ← May import from domain and lib.
lib            ← External UI utility wrappers. Pure functions only.
app (RSC)      ← May import from infrastructure, domain, lib.
components     ← May import from domain, lib.
               Component files (.tsx): Direct imports from infrastructure are prohibited.
               Hook files (hooks/): May import fetch functions from infrastructure only
                 → Limited to queryFn/mutationFn or useActionState connection.
                 → Type imports from @/domain/types or @y0ngha/siglens-core.
```

Phase 9 완료 시 legacy 섹션은 제거된다.

### siglens-core 직접 import 예외 (모든 레이어)

`@y0ngha/siglens-core`는 외부 라이브러리가 아니라 외부 분석 도메인 패키지다. 모든 레이어가 직접 import 가능하다. deep import(`@y0ngha/siglens-core/dist/...`) 금지.

### Server Action 예외

`entities/<x>/actions.ts`(Next.js `'use server'` 파일)는 features/widgets/pages에서 import 가능하다. `entities/<x>/api.ts`는 server-only이므로 same-entity 또는 app 레이어에서만 import.

### ESLint 강제

위 규칙은 `eslint-plugin-boundaries` + `no-restricted-imports`로 정적 검증된다. 위반 시 PR 머지 불가. 자세한 설정은 `eslint.config.mjs`.
```

- [ ] **Step 3: Request Routing 표 확인**

`## ⛔ Request Routing` 섹션은 layer 이름과 무관하므로 변경 없음.

- [ ] **Step 4: Cross-repo scope guard 섹션 확인**

`## ⛔ Cross-repo scope guard` 섹션의 트리거 패턴들은 분석 도메인 변경에 관한 것이라 layer 이름과 무관. 변경 없음.

- [ ] **Step 5: typecheck 통과 확인**

Run: `cd /Users/y0ngha/Project/siglens && yarn typecheck`

Expected: 코드 변경 없으므로 정상 통과.

- [ ] **Step 6: 다음 task로 진행**

---

### Task 3.2: PR 3 검증 + 커밋 + PR 생성

**Files:** spec, plan, CLAUDE.md 변경

- [ ] **Step 1: 변경 파일 목록 확인**

Run: `cd /Users/y0ngha/Project/siglens && git status -s`

Expected:
```
M CLAUDE.md
?? docs/superpowers/plans/2026-05-24-fsd-migration-phase-0.md
?? docs/superpowers/specs/2026-05-24-fsd-migration-design.md
```

3개 (CLAUDE.md modified, spec/plan untracked).

- [ ] **Step 2: 전체 검증**

병렬 실행:
```bash
cd /Users/y0ngha/Project/siglens
yarn format:check &
yarn lint &
yarn typecheck &
yarn test:quiet &
wait
```

Expected: 4개 모두 exit 0.

> CLAUDE.md/docs 변경뿐이므로 영향 없이 통과.

- [ ] **Step 3: 새 branch + 커밋 + PR 생성 (git-agent 위임)**

`git-agent` sub-agent를 호출하여:
- branch: `refactor/fsd-phase-0-spec-claude-md`
- base: master (PR 2가 머지된 상태 가정)
- 스테이지할 파일:
  - `CLAUDE.md` (modified)
  - `docs/superpowers/specs/2026-05-24-fsd-migration-design.md` (untracked)
  - `docs/superpowers/plans/2026-05-24-fsd-migration-phase-0.md` (untracked)
- 커밋 메시지: `refactor(arch): Phase 0 — FSD migration spec + CLAUDE.md 갱신`
- body:
  ```
  - docs/superpowers/specs/2026-05-24-fsd-migration-design.md 머지
  - docs/superpowers/plans/2026-05-24-fsd-migration-phase-0.md 머지
  - CLAUDE.md Layer Dependency Rules를 FSD + legacy 공존 표현으로 갱신
  - siglens-core import 예외, Server Action 예외 명문화

  Phase 0 of FSD migration.
  ```
- PR 제목: `refactor(arch): Phase 0 — FSD migration spec & CLAUDE.md merge`

- [ ] **Step 4: PR URL 확인 + 리뷰 대기**

PR 3 머지 후 Phase 0 완료. Phase 1 plan 작성은 별도 task로 진행 (`writing-plans` 스킬 재호출).

---

## Phase 0 완료 기준

- [ ] PR 1 (config) 머지 완료
- [ ] PR 2 (workflows/agents) 머지 완료
- [ ] PR 3 (spec/CLAUDE.md) 머지 완료
- [ ] master 브랜치에서 `yarn build` 성공
- [ ] master 브랜치에서 `yarn lint`, `yarn typecheck`, `yarn test:quiet` 모두 통과
- [ ] Vercel master 배포 정상 (vercel.json은 변경 없으므로 자동)
- [ ] husky pre-push 통과 (새 coverage 90% threshold + 새 testMatch)
- [ ] ESLint boundaries 위반 0 (새 layer 디렉토리 비어 있음 + legacy 옛 의존 그대로 허용)
- [ ] claude-code-review.yml이 path-agnostic 리뷰를 정상 수행 (Phase 1 첫 PR에서 자연 검증)

---

## Phase 0 이후 — 다음 단계

Phase 0이 머지되면 Phase 1 plan을 작성한다:
- 파일: `docs/superpowers/plans/2026-05-25-fsd-migration-phase-1.md` (작성 일자에 맞춰 변경)
- 범위: shared 레이어 셋업 (spec § 9 Phase 1)
- 예상 PR: 3개 (`shared/lib`, `shared/ui` + `shared/hooks`, `shared/db/cache/email/api` 분리)

Phase 2~9도 각각 별도 plan으로 진행한다.
