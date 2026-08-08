# Spec A — 분석 AI provider를 siglens-core로 승격

- 날짜: 2026-08-02
- 대상 레포: `siglens-core` (siglens/worker는 이 스펙에서 수정하지 않음)
- 후속: Spec B (`2026-08-02-worker-removal-sse-design.md`)

## 배경

`siglens-worker`는 Vercel 함수 타임아웃(요청이 N초 넘으면 소실)을 우회하려고
만든 오프로드 계층이다. AWS 이관으로 그 제약이 사라졌고, worker를 걷어내면
GCP Cloud Run 비용·Redis job 신호 왕복·크로스 클라우드 hop이 함께 사라진다.

worker를 지우려면 그 안의 LLM 호출 능력이 먼저 다른 곳에 있어야 한다.
`SCOPE.md §3` Step 5가 이미 그 자리를 지정하고 있다:

> 분석에 직결된 외부 시스템 I/O인가? (AI provider / 분석 캐시 / 분석 Job 큐)
> `Anthropic / Gemini SDK 호출` → **YES → `siglens-core`의 `infrastructure/`**

즉 이번 작업은 예외 신설이 아니라 **문서 내부 모순 해소 + 드리프트 교정**이다.
(`§0` 요약표의 "Gemini SDK 어댑터 → siglens" 한 줄만 결정 트리와 어긋나 있다.)

## 목표

core가 분석용 LLM 호출을 자체적으로 수행할 수 있게 한다. **이 스펙에서
worker와 siglens는 수정하지 않는다** — Spec B가 곧바로 소비하므로, worker를
core import로 갈아끼우는 중간 단계는 폐기될 작업이라 생략한다.

## 비목표

- 챗봇 경로(`entities/llm-provider`, `requestChatCompletion`) 변경 — 잘 돌고 있고
  계약이 다르다(대화 턴 vs 구조화 출력). 통합은 Spec B 이후 별도 판단.
- worker 삭제, Redis job 제거, SSE — 전부 Spec B.

## 이동 대상

`siglens-worker/src/` → `siglens-core/src/`

| worker 파일 | 줄수 | core 행선지 |
|---|---|---|
| `claude.ts` `gemini.ts` `chatgpt.ts` `deepseek.ts` | 935 | `infrastructure/ai/providers/` |
| `retry.ts` `claude-retry.ts` `gemini-retry.ts` `chatgpt-retry.ts` `deepseek-retry.ts` | 459 | `infrastructure/ai/retry/` |
| `usage.ts` | 185 | `infrastructure/ai/usage.ts` |
| `ai-response.ts` | 28 | `infrastructure/ai/` — 기존 `extractJsonWithRepair.ts`와 통합 검토 |
| `key-routing.ts` | 89 | `domain/tier/` 또는 `application/analysis/` (core 함수에 위임하는 순수 정책) |
| `briefing-model.ts` | 27 | `application/analysis/` |
| `index.ts`의 `callAnalysisAI` / `callBriefingAI` | ~120 | `application/analysis/callAnalysisAi.ts` |

**이동하지 않는 것**: `models.ts`(거의 전부 core re-export — 삭제 대상),
`config.ts`(worker env 리더), `index.ts` 나머지(HTTP 라우팅 — Spec B에서 소멸).

## 공개 API

분석 전용 포트를 신설한다. 챗봇의 `CallAiProvider`는 건드리지 않는다.

```ts
export interface CallAnalysisAiOptions {
    prompt: string;
    model: ActiveModelId;
    tier: Tier | undefined;
    /** BYOK. 없으면 서버 키를 쓴다(free 모델 또는 pro 티어). */
    userApiKey?: string;
    signal?: AbortSignal;
    system?: string;
    responseSchema?: unknown;
    seed?: number;
    thinkingBudget?: number;
    reasoning?: boolean;
    /** 로그 상관용. 호출 실패를 어느 분석에 귀속시킬지 식별한다. */
    correlationId?: string;
}

/** 재시도·provider 라우팅·응답 정규화를 포함한다. 정규화된 JSON 문자열을 반환. */
export function callAnalysisAi(options: CallAnalysisAiOptions): Promise<string>;

/** 브리핑 전용 — gemini/deepseek만 지원, 서버 키 고정. */
export function callBriefingAi(options: CallBriefingAiOptions): Promise<string>;
```

`jobId` → `correlationId`로 개명한다. Spec B에서 job 개념이 사라지므로 이름이
남으면 곧 거짓말이 된다.

## API 키

core가 `process.env`를 직접 읽는다. `readUpstashConfig`(`infrastructure/upstash/config.ts`)가
이미 그 패턴이고 `SCOPE.md §1`이 명시한다("core의 infrastructure가 process.env를
읽되 값을 채우는 책임은 consumer").

읽는 이름은 worker와 동일하게 유지한다:
`ANTHROPIC_API_KEY` `GEMINI_API_KEY` `OPENAI_API_KEY` `DEEPSEEK_API_KEY`,
브리핑 기본 모델은 `BRIEFING_GEMINI_MODEL` `BRIEFING_DEEPSEEK_MODEL`.

**worker의 `requireEnv`(startup crash) 방식은 가져오지 않는다.** core는
라이브러리라 import 시점에 던지면 안 된다 — 키가 없는 provider는 **호출 시점에**
명확한 에러를 던진다. 챗봇 키(`*_CHAT_API_KEY`)와는 별개 이름이므로 충돌 없다.

## 동작 보존

worker에서 실제로 운영 중인 다음 동작을 그대로 유지한다. 리팩토링이 아니라
이동이므로 **행동 변경은 이 스펙의 범위 밖**이다.

- `reasoning` boolean → provider별 번역 (`false`=deepseek thinking:false /
  gemini thinkingBudget:0 / claude·gpt effort:'low'; `true`=deepseek만 override;
  `undefined`=무개입)
- Gemini·DeepSeek 경로의 누적 재시도 상한 `abortIfCumulativeDelayReachesMs = 30_000`.
  **Claude/ChatGPT에는 의도적으로 적용하지 않는다**(기본 5분 상한 유지) — worker
  주석이 "누락된 cap으로 오인해 추가하지 말 것"이라고 명시한다.
- `normalizeJsonResponse`의 폴백 순서: `JSON.parse` → 실패 시 `jsonrepair` →
  둘 다 실패하면 **원래 SyntaxError를 rethrow**(하위 호환).
- `shouldUseServerKey` / `requiresUserApiKey` / `isModelAllowedForTier`의 현 의미.

## 테스트

worker의 기존 테스트를 함께 이식한다(`__tests__` 12개 파일). core는 vitest,
worker는 jest이므로 러너 문법만 변환하고 **단언은 바꾸지 않는다** — 단언이
바뀌면 이동이 아니라 재작성이다.

이식 후 커버리지 90% 이상을 유지한다. 신규 테스트가 필요한 지점:
- 키 부재 시 호출 시점 에러 (worker의 startup crash를 대체한 동작)
- `correlationId` 개명이 로그 라인에 반영되는지

## 완료 조건

1. `yarn test` / `yarn typecheck` / `yarn lint` 통과, 커버리지 90%+
2. `callAnalysisAi` / `callBriefingAi`가 `src/index.ts`에서 export
3. worker·siglens 레포에 변경 없음
4. core 릴리스(`yarn release`)로 새 버전 발행 — Spec B가 이 버전을 핀한다
