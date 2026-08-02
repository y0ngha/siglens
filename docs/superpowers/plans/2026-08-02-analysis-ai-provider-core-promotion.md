# Spec A — 분석 AI provider core 승격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `siglens-core`가 분석용 LLM 호출을 자체 수행할 수 있게 한다 — worker의 provider 어댑터·재시도·사용량 정규화·키 라우팅을 core로 이동.

**Architecture:** worker의 leaf 모듈(`usage`/`retry`/`ai-response`)부터 옮기고, 그 위에 provider 어댑터 4종, 다시 그 위에 retry 래퍼 4종, 마지막에 `callAnalysisAi`/`callBriefingAi` 진입점을 얹는다. 의존 역순이라 각 태스크가 독립적으로 컴파일·테스트된다.

**Tech Stack:** TypeScript, vitest(core) ← jest(worker) 변환, `@anthropic-ai/sdk`, `@google/genai`, `openai`, `jsonrepair`

**작업 위치:** `/Users/y0ngha/Project/siglens-core-worker-removal` (브랜치 `feat/analysis-ai-provider`)
**원본 참조:** `/Users/y0ngha/Project/siglens-worker/src/`
**스펙:** `docs/superpowers/specs/2026-08-02-analysis-ai-provider-core-promotion-design.md` (siglens 레포)

---

## 파일 구조

생성할 파일과 각자의 책임:

| 파일 | 책임 |
|---|---|
| `src/infrastructure/ai/usage.ts` | provider별 토큰 usage → `NormalizedUsage` 정규화 |
| `src/infrastructure/ai/retry/withRetry.ts` | provider 무관 재시도 루프 (백오프, 누적지연 상한) |
| `src/infrastructure/ai/providers/anthropic.ts` | Anthropic SDK 호출 |
| `src/infrastructure/ai/providers/gemini.ts` | Google GenAI SDK 호출 |
| `src/infrastructure/ai/providers/openai.ts` | OpenAI SDK 호출 |
| `src/infrastructure/ai/providers/deepseek.ts` | DeepSeek(OpenAI 호환) 호출 |
| `src/infrastructure/ai/retry/{anthropic,gemini,openai,deepseek}Retry.ts` | provider별 재시도 정책 래퍼 |
| `src/infrastructure/ai/serverKeys.ts` | provider별 서버 API 키 env 리더 (호출 시점 검증) |
| `src/domain/tier/keyRouting.ts` | `shouldUseServerKey`/`requiresUserApiKey`/`isModelAllowedForTier` |
| `src/application/analysis/callAnalysisAi.ts` | 분석 진입점 — 모델 라우팅 + reasoning 번역 + 정규화 |
| `src/application/analysis/callBriefingAi.ts` | 브리핑 진입점 — gemini/deepseek 한정, 서버 키 고정 |
| `src/application/analysis/briefingModel.ts` | 브리핑 가능 모델 폴백 해석 |

**주의:** worker의 `models.ts`는 옮기지 않는다. 거의 전부 core re-export이므로,
core 내부에서는 `@/domain/types`·`@/domain/tier`에서 직접 import한다.

**import 치환 규칙** (모든 태스크 공통):
- `from './models.js'` → core 내부 경로 (`@/domain/types`, `@/domain/tier` 등)
- `from '@y0ngha/siglens-core'` → core 내부 경로 (자기 자신이므로)
- `from './usage.js'` → `@/infrastructure/ai/usage`
- `.js` 확장자 제거 (core는 tsc-alias 기반, worker는 ESM)

---

### Task 1: usage 정규화 이동

**Files:**
- Create: `src/infrastructure/ai/usage.ts`
- Create: `src/infrastructure/ai/__tests__/usage.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/usage.ts` (185줄, 무의존)
- Source test: `/Users/y0ngha/Project/siglens-worker/src/__tests__/usage.test.ts`

- [ ] **Step 1: 원본 읽기**

```bash
cat /Users/y0ngha/Project/siglens-worker/src/usage.ts
cat /Users/y0ngha/Project/siglens-worker/src/__tests__/usage.test.ts
```

- [ ] **Step 2: 테스트 먼저 이식 (jest → vitest)**

`src/infrastructure/ai/__tests__/usage.test.ts`로 복사한 뒤 러너 문법만 변환:
- `import { describe, expect, it } from 'vitest';` 를 파일 최상단에 추가
- `jest.fn()` → `vi.fn()` (있는 경우만)
- import 경로를 `../usage`로 수정

**단언은 한 글자도 바꾸지 않는다.** 단언이 바뀌면 이동이 아니라 재작성이다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd /Users/y0ngha/Project/siglens-core-worker-removal && npx vitest run src/infrastructure/ai/__tests__/usage.test.ts`
Expected: FAIL — `Failed to resolve import "../usage"`

- [ ] **Step 4: usage.ts 이식**

`/Users/y0ngha/Project/siglens-worker/src/usage.ts`를 `src/infrastructure/ai/usage.ts`로 복사.
이 파일은 외부 import가 없으므로 **내용 수정이 필요 없다**. JSDoc의
`siglens-core docs/superpowers/specs/...` 상대 경로 언급만 core 기준으로 확인.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/__tests__/usage.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/infrastructure/ai/usage.ts src/infrastructure/ai/__tests__/usage.test.ts
git commit -m "feat: worker의 AI usage 정규화를 core로 이동"
```

---

### Task 2: 재시도 루프 이동

**Files:**
- Create: `src/infrastructure/ai/retry/withRetry.ts`
- Create: `src/infrastructure/ai/retry/__tests__/withRetry.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/retry.ts` (160줄, 무의존)
- Source test: `/Users/y0ngha/Project/siglens-worker/src/__tests__/retry.test.ts`

- [ ] **Step 1: 원본 읽기**

```bash
cat /Users/y0ngha/Project/siglens-worker/src/retry.ts
cat /Users/y0ngha/Project/siglens-worker/src/__tests__/retry.test.ts
```

- [ ] **Step 2: 테스트 이식 (jest → vitest)**

Task 1 Step 2와 동일한 변환. 타이머를 쓰는 테스트라면
`vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()`로 대응한다
(jest의 `jest.useFakeTimers()` 대응).

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/infrastructure/ai/retry/__tests__/withRetry.test.ts`
Expected: FAIL — import 해결 실패

- [ ] **Step 4: retry.ts 이식**

`retry.ts` → `src/infrastructure/ai/retry/withRetry.ts`. 무의존이라 내용 수정 없음.

**보존해야 할 계약:** `RETRY_ALLOWABLE_TIME_MS`(기본 300_000ms) 와
`abortIfCumulativeDelayReachesMs` 옵션의 의미를 그대로 유지한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/retry/__tests__/withRetry.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/infrastructure/ai/retry/
git commit -m "feat: worker의 재시도 루프를 core로 이동"
```

---

### Task 3: JSON 응답 정규화 통합

**Files:**
- Modify: `src/infrastructure/ai/extractJsonWithRepair.ts` (기존 파일)
- Create: `src/infrastructure/ai/normalizeJsonResponse.ts`
- Create: `src/infrastructure/ai/__tests__/normalizeJsonResponse.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/ai-response.ts` (28줄)
- Source test: `/Users/y0ngha/Project/siglens-worker/src/__tests__/ai-response.test.ts`

- [ ] **Step 1: 기존 core 구현과 비교**

```bash
cat /Users/y0ngha/Project/siglens-core-worker-removal/src/infrastructure/ai/extractJsonWithRepair.ts
cat /Users/y0ngha/Project/siglens-worker/src/ai-response.ts
```

두 함수의 차이를 확인한다. `normalizeJsonResponse`는 ```json 코드펜스를 벗기고
`JSON.parse` → `jsonrepair` 순서로 폴백하며 **둘 다 실패하면 원래 SyntaxError를
rethrow**한다. `extractJsonWithRepair`가 동일 동작이면 재사용하고, 다르면
별도 파일로 둔다.

- [ ] **Step 2: 테스트 이식**

`src/infrastructure/ai/__tests__/normalizeJsonResponse.test.ts`로 이식.
**rethrow 동작을 검증하는 단언을 반드시 포함**한다 — 하위 호환 계약이다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/infrastructure/ai/__tests__/normalizeJsonResponse.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

Step 1의 판단에 따라 둘 중 하나:
- 기존 `extractJsonWithRepair`로 충분 → `normalizeJsonResponse`를 그 위의 얇은 래퍼로 작성
- 동작이 다름 → `ai-response.ts` 내용을 `normalizeJsonResponse.ts`로 이식

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/__tests__/normalizeJsonResponse.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/infrastructure/ai/
git commit -m "feat: AI JSON 응답 정규화를 core로 이동"
```

---

### Task 4: 서버 API 키 리더

**Files:**
- Create: `src/infrastructure/ai/serverKeys.ts`
- Create: `src/infrastructure/ai/__tests__/serverKeys.test.ts`

worker의 `config.ts`는 `requireEnv`로 **import 시점에 던진다**. core는 라이브러리라
그러면 안 된다 — 키 없는 provider를 쓰지 않는 consumer까지 죽는다.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveServerApiKey } from '../serverKeys';

describe('resolveServerApiKey', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('provider별 env를 읽는다', () => {
        vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant');
        expect(resolveServerApiKey('anthropic')).toBe('sk-ant');
    });

    it('키가 없으면 호출 시점에 provider 이름을 담아 던진다', () => {
        vi.stubEnv('GEMINI_API_KEY', '');
        expect(() => resolveServerApiKey('google')).toThrowError(
            /GEMINI_API_KEY/
        );
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/infrastructure/ai/__tests__/serverKeys.test.ts`
Expected: FAIL — `Failed to resolve import "../serverKeys"`

- [ ] **Step 3: 구현**

```ts
import type { LlmProvider } from '@/domain/types';

const ENV_BY_PROVIDER: Record<LlmProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
};

/**
 * 서버 소유 provider 키를 읽는다.
 *
 * worker는 startup에 `requireEnv`로 던졌지만 core는 라이브러리다 — import 시점에
 * 던지면 해당 provider를 쓰지 않는 consumer까지 죽는다. 그래서 호출 시점에만
 * 검증한다.
 */
export function resolveServerApiKey(provider: LlmProvider): string {
    const envName = ENV_BY_PROVIDER[provider];
    const value = process.env[envName];
    if (!value) {
        throw new Error(`${envName} environment variable is required`);
    }
    return value;
}
```

`LlmProvider` 타입의 실제 이름·경로는 core에서 확인 후 맞춘다
(`src/domain/types.ts` 또는 `src/domain/tier.ts`).

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/__tests__/serverKeys.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/infrastructure/ai/serverKeys.ts src/infrastructure/ai/__tests__/serverKeys.test.ts
git commit -m "feat: 분석 provider 서버 키 리더 추가"
```

---

### Task 5: provider 어댑터 4종 이동

**Files:**
- Create: `src/infrastructure/ai/providers/{anthropic,gemini,openai,deepseek}.ts`
- Create: `src/infrastructure/ai/providers/__tests__/{anthropic,gemini,openai,deepseek}.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/{claude,gemini,chatgpt,deepseek}.ts` (935줄)
- Source test: `/Users/y0ngha/Project/siglens-worker/src/__tests__/{claude,gemini,chatgpt,deepseek}.test.ts`

**파일명 매핑** (core는 provider 이름 기준으로 통일):
`claude.ts`→`anthropic.ts`, `gemini.ts`→`gemini.ts`, `chatgpt.ts`→`openai.ts`, `deepseek.ts`→`deepseek.ts`

- [ ] **Step 1: SDK 의존성 확인**

```bash
cd /Users/y0ngha/Project/siglens-core-worker-removal
grep -E '"(@anthropic-ai/sdk|@google/genai|openai|jsonrepair)"' package.json
```

없는 패키지는 worker의 `package.json`과 **동일한 버전**으로 추가한다:
`@anthropic-ai/sdk` 0.92.0, `@google/genai` ^1.50.1, `openai` 6.35.0, `jsonrepair` ^3.14.0

```bash
yarn add @anthropic-ai/sdk@0.92.0 @google/genai@^1.50.1 openai@6.35.0 jsonrepair@^3.14.0
```

- [ ] **Step 2: 테스트 4개 이식**

각 테스트를 `providers/__tests__/`로 복사하고 러너 문법만 변환.
`jest.mock('@anthropic-ai/sdk')` → `vi.mock('@anthropic-ai/sdk')` 형태로 치환.
**단언은 변경 금지.**

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/infrastructure/ai/providers/`
Expected: FAIL — import 해결 실패

- [ ] **Step 4: 어댑터 4개 이식**

각 파일을 복사한 뒤 import만 치환한다 (파일 상단 "import 치환 규칙" 적용):
- `./models.js` → core 타입 경로
- `./usage.js` → `@/infrastructure/ai/usage`
- `@y0ngha/siglens-core` → core 내부 경로

**본문 로직은 변경하지 않는다.** 특히 보존할 것:
- Gemini의 `thinkingConfig` 처리 — `thinkingBudget` 생략과 `0`은 의미가 다르다
- Claude의 cache-write 토큰 분리 집계
- DeepSeek의 `thinking` 토글

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/providers/`
Expected: PASS (4개 파일 전부)

- [ ] **Step 6: 커밋**

```bash
git add package.json yarn.lock src/infrastructure/ai/providers/
git commit -m "feat: LLM provider 어댑터 4종을 core로 이동"
```

---

### Task 6: provider별 재시도 래퍼 4종 이동

**Files:**
- Create: `src/infrastructure/ai/retry/{anthropic,gemini,openai,deepseek}Retry.ts`
- Create: `src/infrastructure/ai/retry/__tests__/{anthropic,gemini,openai,deepseek}Retry.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/{claude,gemini,chatgpt,deepseek}-retry.ts` (299줄)

- [ ] **Step 1: 테스트 4개 이식**

Task 5 Step 2와 동일 변환.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/infrastructure/ai/retry/`
Expected: FAIL — 새 4개 파일 import 실패 (Task 2의 `withRetry.test.ts`는 계속 PASS)

- [ ] **Step 3: 래퍼 4개 이식**

import 치환:
- `./claude.js` → `@/infrastructure/ai/providers/anthropic`
- `./gemini.js` → `@/infrastructure/ai/providers/gemini`
- `./chatgpt.js` → `@/infrastructure/ai/providers/openai`
- `./deepseek.js` → `@/infrastructure/ai/providers/deepseek`
- `./retry.js` → `@/infrastructure/ai/retry/withRetry`

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/infrastructure/ai/retry/`
Expected: PASS (5개 파일 — withRetry + 4 provider)

- [ ] **Step 5: 커밋**

```bash
git add src/infrastructure/ai/retry/
git commit -m "feat: provider별 재시도 래퍼를 core로 이동"
```

---

### Task 7: 키 라우팅 + 브리핑 모델 해석 이동

**Files:**
- Create: `src/domain/tier/keyRouting.ts`
- Create: `src/domain/tier/__tests__/keyRouting.test.ts`
- Create: `src/application/analysis/briefingModel.ts`
- Create: `src/application/analysis/__tests__/briefingModel.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/key-routing.ts` (89줄), `briefing-model.ts` (27줄)

`src/domain/tier`가 파일이면 디렉토리로 승격하지 말고 `src/domain/keyRouting.ts`에 둔다.
기존 구조를 확인 후 결정한다: `ls src/domain/`

- [ ] **Step 1: 테스트 2개 이식**

Run: `cat /Users/y0ngha/Project/siglens-worker/src/__tests__/key-routing.test.ts`
Run: `cat /Users/y0ngha/Project/siglens-worker/src/__tests__/briefing-model.test.ts`

러너 문법만 변환해 이식.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/domain/ src/application/analysis/`
Expected: FAIL — 새 파일 import 실패

- [ ] **Step 3: 구현 이식**

`key-routing.ts`의 3개 함수(`shouldUseServerKey`/`requiresUserApiKey`/`isModelAllowedForTier`)를
이식한다. 이 함수들은 이미 core의 `isFreeModel`/`isModelAllowed`에 위임하므로
import가 `@y0ngha/siglens-core` → 내부 상대 경로로만 바뀐다.

`isModelAllowedForTier`의 긴 JSDoc(정책 플래그 추적용이지 1차 방어선이 아니라는 설명)을
**그대로 보존**한다 — 이 프로젝트는 multi-line 주석을 허용하며, 이 주석은
과거 "무한 스피너" 인시던트의 재발 방지 기록이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/domain/ src/application/analysis/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domain/ src/application/analysis/
git commit -m "feat: 키 라우팅·브리핑 모델 해석을 core로 이동"
```

---

### Task 8: `callAnalysisAi` / `callBriefingAi` 진입점

**Files:**
- Create: `src/application/analysis/callAnalysisAi.ts`
- Create: `src/application/analysis/callBriefingAi.ts`
- Create: `src/application/analysis/__tests__/callAnalysisAi.test.ts`
- Create: `src/application/analysis/__tests__/callBriefingAi.test.ts`
- Source: `/Users/y0ngha/Project/siglens-worker/src/index.ts` 의 `callAnalysisAI`(약 80줄)와 `callBriefingAI`

- [ ] **Step 1: 원본 읽기**

```bash
sed -n '60,200p' /Users/y0ngha/Project/siglens-worker/src/index.ts
grep -n "async function callBriefingAI" -A 60 /Users/y0ngha/Project/siglens-worker/src/index.ts
```

- [ ] **Step 2: 실패 테스트 작성**

`vi.mock`으로 4개 retry 래퍼를 스텁하고, 다음을 검증한다:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infrastructure/ai/retry/anthropicRetry', () => ({
    callAnthropicWithRetry: vi.fn().mockResolvedValue('{"ok":true}'),
}));
// gemini/openai/deepseek도 동일하게 스텁

import { callAnalysisAi } from '../callAnalysisAi';
import { callGeminiWithRetry } from '@/infrastructure/ai/retry/geminiRetry';

describe('callAnalysisAi', () => {
    it('reasoning=false면 gemini thinkingBudget을 0으로 강제한다', async () => {
        await callAnalysisAi({
            prompt: 'p',
            model: 'gemini-2.5-flash',
            tier: 'free',
            reasoning: false,
        });
        expect(vi.mocked(callGeminiWithRetry).mock.calls[0][3]).toMatchObject({
            budgetRef: { current: 0 },
        });
    });

    it('reasoning=undefined면 어떤 override도 걸지 않는다', async () => {
        await callAnalysisAi({
            prompt: 'p',
            model: 'gemini-2.5-flash',
            tier: 'free',
        });
        expect(
            vi.mocked(callGeminiWithRetry).mock.calls[0][3]?.budgetRef
        ).toBeUndefined();
    });
});
```

모델 ID·인자 위치는 원본 시그니처 확인 후 맞춘다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/application/analysis/__tests__/callAnalysisAi.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

worker `index.ts`의 `callAnalysisAI` 본문을 옮기되 시그니처를 옵션 객체로 바꾼다
(스펙의 `CallAnalysisAiOptions`). 인자 11개 positional은 호출부에서 실수하기 쉽다.

`jobId` → `correlationId`로 개명한다. Spec B에서 job 개념이 사라지므로
이름이 남으면 거짓말이 된다.

`shouldUseServerKey(model, tier)`가 true면 `resolveServerApiKey(provider)`,
false면 `options.userApiKey`를 쓴다. 둘 다 없으면 명확한 에러를 던진다.

**보존할 동작:**
- `reasoning` → provider별 번역 (false=최소화, true=deepseek만 override, undefined=무개입)
- Gemini·DeepSeek만 `abortIfCumulativeDelayReachesMs: 30_000`.
  **Claude/ChatGPT에는 넣지 않는다** — worker 주석이 명시적으로 경고한다.
- 반환 전 `normalizeJsonResponse` 적용

`callBriefingAi`는 `resolveBriefingModel`로 모델을 정하고 gemini/deepseek만
디스패치하며, 서버 키를 고정 사용하고 `BRIEFING_MAX_RETRY_DELAY_MS = 10_000`을 쓴다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/application/analysis/`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/application/analysis/
git commit -m "feat: callAnalysisAi/callBriefingAi 진입점 추가"
```

---

### Task 9: 공개 export + 전체 게이트 + 릴리스

**Files:**
- Modify: `src/index.ts`
- Modify: `docs/PUBLIC_API.md` (있는 경우)

- [ ] **Step 1: export 추가**

`src/index.ts`의 "Tier 1 — Application Entrypoints" 섹션에 추가:

```ts
// Analysis AI provider (Spec A — worker 승격)
export { callAnalysisAi } from './application/analysis/callAnalysisAi';
export { callBriefingAi } from './application/analysis/callBriefingAi';
export type {
    CallAnalysisAiOptions,
    CallBriefingAiOptions,
} from './application/analysis/types';
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: exit 0, 출력 없음

- [ ] **Step 3: 전체 테스트 + 커버리지**

Run: `yarn test:coverage`
Expected: 전체 PASS, 신규 `infrastructure/ai/**`·`application/analysis/**` 커버리지 90% 이상

커버리지가 90% 미만인 파일이 있으면 그 파일의 미커버 분기를 확인하고 테스트를 추가한다.

- [ ] **Step 4: lint + format**

Run: `yarn lint && yarn format:check`
Expected: 둘 다 exit 0

- [ ] **Step 5: 빌드 확인**

Run: `yarn build`
Expected: exit 0, `dist/`에 `application/analysis/callAnalysisAi.js` 생성

- [ ] **Step 6: 커밋**

```bash
git add src/index.ts docs/
git commit -m "feat: callAnalysisAi/callBriefingAi 공개 API 노출"
```

- [ ] **Step 7: 릴리스**

main 병합 후 `yarn release`로 새 버전을 발행한다. Spec B가 이 버전을 핀한다.
릴리스는 GitHub Packages + `v*` 태그 push 방식이다
(`npm version` 후 `git push --tags` — API로 만든 ref는 publish 워크플로를 켜지 않는다).

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 태스크 |
|---|---|
| 어댑터 4종 이동 | Task 5 |
| retry 5종 이동 | Task 2, 6 |
| usage 이동 | Task 1 |
| ai-response 통합 | Task 3 |
| key-routing 이동 | Task 7 |
| briefing-model 이동 | Task 7 |
| `callAnalysisAi` 진입점 | Task 8 |
| `correlationId` 개명 | Task 8 Step 4 |
| env를 core가 읽되 호출 시점 검증 | Task 4 |
| 동작 보존 (reasoning 번역, cap 비대칭, rethrow) | Task 8 Step 4, Task 3 Step 2, Task 5 Step 4 |
| 테스트 이식 + 90% | Task 1~8의 Step 2, Task 9 Step 3 |
| worker·siglens 무변경 | 모든 태스크가 core 워크트리에서만 작업 |
| core 릴리스 | Task 9 Step 7 |

누락 없음.

**2. Placeholder 스캔**

"TBD"/"적절히 처리"/"비슷하게" 없음. Task 3 Step 4와 Task 7의 경로 결정은
"확인 후 결정"이지만 확인 명령과 판단 기준을 함께 제시했으므로 실행 가능하다.

**3. 타입 일관성**

`CallAnalysisAiOptions`(Task 8) ↔ `src/application/analysis/types`(Task 9 export) 일치.
`resolveServerApiKey(provider: LlmProvider)`(Task 4) ↔ Task 8에서 동일 시그니처로 호출.
파일명 매핑(`claude.ts`→`anthropic.ts`)이 Task 5와 Task 6에서 일관.
