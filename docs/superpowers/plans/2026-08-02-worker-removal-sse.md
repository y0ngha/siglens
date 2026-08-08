# Spec B — worker 제거 + Redis job 신호 제거 + SSE 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `siglens`·`siglens-trader`가 worker를 의존하지 않고 Redis를 job 신호로 폴링하지 않게 한다. 분석은 SSE 한 연결 안에서 완료까지 대기한다.

**Architecture:** core의 `submit*`/`poll*` 쌍을 `run*` 하나로 접는다. `submit`의 1~5단계(게이트·캐시·bars·프롬프트)는 그대로 두고, worker dispatch 대신 Spec A의 `callAnalysisAi`를 `await`한 뒤 `poll`의 후처리(enrich·reconcile·filter·캐시write)를 같은 함수 안에서 수행한다. siglens는 SSE route handler 하나로 `run*`를 감싸고 25초 heartbeat를 흘린다.

**Tech Stack:** TypeScript, Next.js Route Handler + `ReadableStream`, vitest, Playwright

**작업 위치:**
- core: `/Users/y0ngha/Project/siglens-core-worker-removal` (브랜치 `feat/analysis-ai-provider`)
- siglens: `/Users/y0ngha/Project/siglens-worker-removal` (브랜치 `feat/worker-removal-sse`)
- trader: 별도 워크트리 생성 필요

**스펙:** `docs/superpowers/specs/2026-08-02-worker-removal-sse-design.md`

## 실측으로 확정된 전제 (v0.50.1 `/api/sse-probe`)

| 측정 | 결과 |
|---|---|
| 침묵(heartbeat 없음) | **61.1초에 끊김** — ALB idle 60초. HTTP/2 `INTERNAL_ERROR`, 524 아님 |
| 30초 heartbeat / 150초 | 완주, drift 581~613ms 일정 |
| 5초 heartbeat / 150초(30개) | 완주, **뭉침 0건** |
| 30초 heartbeat / 280초 | 286초 완주 |

CF Proxy Read Timeout 125초는 스트리밍을 막지 않았다. **진짜 벽은 ALB idle 60초**이고 heartbeat로 넘는다. heartbeat는 **25초**(60초의 절반 이하 안전마진)로 고정하며 ALB 설정은 바꾸지 않는다.

---

## 파일 구조

### core (신규/수정)

| 파일 | 책임 |
|---|---|
| `src/application/market/runAnalysis.ts` | technical 분석 1회 완주 (submit 1~5 + LLM await + poll 후처리) |
| `src/application/analysis/inFlight.ts` | 같은 캐시키 동시 요청 합류 (프로세스 로컬) |
| 나머지 12개 use-case의 `run*.ts` | 각 도메인별 동일 패턴 |

### core (삭제)

`infrastructure/jobs/**`, `application/workerDispatch.ts`, `application/market/cancelAnalysisJob.ts`, `poll*.ts` 13개, `submit*.ts` 13개, `readWorkerConfig`

### siglens (신규/수정)

| 파일 | 책임 |
|---|---|
| `src/app/api/analysis/stream/route.ts` | SSE 엔드포인트 1개 — type으로 13개 use-case 디스패치 |
| `src/shared/lib/sse/heartbeatStream.ts` | heartbeat + 타이머 회수를 담은 스트림 래퍼 |
| `src/shared/hooks/useAnalysisStream.ts` | 공통 SSE 소비 훅 |
| 기존 훅 6종 | `useAnalysisStream`을 래핑하되 반환 타입·에러 문구 유지 |

### siglens (삭제)

`shared/config/pollingConfig.ts`, `shared/lib/cancelJobsApi.ts`, `app/api/jobs/cancel/route.ts`, `poll*Action` 10개

---

### Task 1: in-flight 중복 제거 (core)

**Files:**
- Create: `src/application/analysis/inFlight.ts`
- Create: `src/__tests__/application/analysis/inFlight.test.ts`

SSE는 연결마다 `run*`를 호출하므로, 같은 캐시키에 동시 요청이 오면 LLM을 중복 호출한다. 분석 캐시는 *완료된* 결과만 막아주지 in-flight는 못 막는다.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, expect, it, vi } from 'vitest';
import { dedupeInFlight } from '@/application/analysis/inFlight';

describe('dedupeInFlight', () => {
    it('같은 키의 동시 호출은 한 번만 실행된다', async () => {
        const fn = vi.fn().mockResolvedValue('r');
        const [a, b] = await Promise.all([
            dedupeInFlight('k', fn),
            dedupeInFlight('k', fn),
        ]);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(a).toBe('r');
        expect(b).toBe('r');
    });

    it('완료 후에는 다시 실행된다', async () => {
        const fn = vi.fn().mockResolvedValue('r');
        await dedupeInFlight('k', fn);
        await dedupeInFlight('k', fn);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('실패해도 항목을 남기지 않는다', async () => {
        const fail = vi.fn().mockRejectedValue(new Error('x'));
        await expect(dedupeInFlight('k', fail)).rejects.toThrow('x');
        const ok = vi.fn().mockResolvedValue('r');
        await expect(dedupeInFlight('k', ok)).resolves.toBe('r');
    });

    it('다른 키는 서로 합류하지 않는다', async () => {
        const fn = vi.fn().mockResolvedValue('r');
        await Promise.all([dedupeInFlight('a', fn), dedupeInFlight('b', fn)]);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/__tests__/application/analysis/inFlight.test.ts`
Expected: FAIL — unresolved import

- [ ] **Step 3: 구현**

```ts
const inFlight = new Map<string, Promise<unknown>>();

/**
 * 같은 키의 동시 호출을 하나의 진행 중 실행에 합류시킨다.
 *
 * ponytail: 프로세스 로컬 Map. ASG desired=1이라 실질 위험이 낮고, 다중 인스턴스에서
 * 최악의 결과는 "LLM 1회 중복"이다. 중복이 실제로 관측되면 Redis 락으로 승격한다.
 */
export async function dedupeInFlight<T>(
    key: string,
    run: () => Promise<T>
): Promise<T> {
    const existing = inFlight.get(key);
    if (existing !== undefined) return existing as Promise<T>;

    const promise = run().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise as Promise<T>;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/__tests__/application/analysis/inFlight.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

`feat: 분석 in-flight 중복 제거 추가`

---

### Task 2: `runAnalysis` — technical 1개 먼저 (core)

**Files:**
- Create: `src/application/market/runAnalysis.ts`
- Create: `src/__tests__/application/market/runAnalysis.test.ts`
- Reference: `src/application/market/submitAnalysis.ts`, `src/application/market/pollAnalysis.ts`

13개를 한 번에 바꾸지 않는다. 하나로 패턴을 확정하고 실증한 뒤 나머지를 따른다.

- [ ] **Step 1: 원본 두 파일 정독**

```bash
cat src/application/market/submitAnalysis.ts
cat src/application/market/pollAnalysis.ts
```

`submitAnalysisWithVisibility`의 1~5단계와 `pollAnalysis`의 후처리 경계를 정확히 파악한다.

- [ ] **Step 2: 실패 테스트 작성**

`vi.mock('@/application/analysis/callAnalysisAi')`로 LLM을 스텁하고 검증한다:

```ts
// 캐시 히트면 LLM을 호출하지 않는다
// skipEnqueueIfMiss(봇)면 miss_no_trigger를 반환하고 LLM을 호출하지 않는다
// 캐시 미스면 callAnalysisAi를 1회 호출하고 done + result를 반환한다
// tier가 timeframe을 허용하지 않으면 error를 반환한다
// AbortSignal이 callAnalysisAi에 그대로 전달된다
// 결과가 캐시에 기록된다 (TTL은 computeEffectiveTtl)
// fallback 분석이면 캐시 write를 건너뛴다
// 같은 캐시키 동시 호출은 callAnalysisAi를 1회만 태운다
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/__tests__/application/market/runAnalysis.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

`submitAnalysisWithVisibility`를 복사해 다음만 바꾼다:

삭제할 것 — `readWorkerConfig()`, `crypto.randomUUID()`, `setJobMeta(...)`, `dispatchWorkerJob(...)`, `fireAndForget(dispatch, options)`, `{ status:'submitted', jobId }` 반환

추가할 것 — 프롬프트 빌드 직후:

```ts
const raw = await dedupeInFlight(cacheKey, () =>
    callAnalysisAi({
        prompt,
        model: effectiveModelId,
        tier,
        userApiKey: options.userApiKey,
        signal: options.signal,
        system,
        responseSchema: TECHNICAL_RESPONSE_SCHEMA,
        seed: analysisSeed(`${system}\n\n${prompt}`),
        reasoning: options.reasoning,
        correlationId: `${symbol}:${timeframe}`,
    })
);
```

그 뒤 `pollAnalysis`의 후처리를 그대로 이어붙인다 — `JSON.parse(raw)` → `enrichAnalysisWithConfidence` → `postProcessAnalysisWithReconcile(enriched, lastClose, atr)` → `analyzedAt` 부여 → `isFallbackAnalysis`가 아니면 캐시 write → `filterAnalysisResult(result, tier, tierConfig)`.

**`meta`는 Redis에 쓰지 않는다** — `lastClose`/`atr`/`cacheKey`가 이제 같은 함수 스코프의 지역변수다. 이게 이 리팩토링의 핵심 이득이다.

**caller-tier 재검사는 불필요하다** — submit과 poll이 한 함수가 되어 tier가 중간에 바뀔 수 없다. `pollAnalysis`의 그 가드는 두 호출 사이의 시간 간격 때문에 존재했으므로 함께 사라진다.

`options.signal`을 `SubmitAnalysisOptions`에 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/__tests__/application/market/runAnalysis.test.ts`
Expected: PASS

- [ ] **Step 6: export + 커밋**

`src/index.ts`에 `export { runAnalysis }` 추가. `submitAnalysis`/`pollAnalysis`는 **아직 남겨둔다** — siglens 전환 전까지 프로덕션이 그 경로를 쓴다.

`feat: runAnalysis 추가 (submit+poll 통합)`

---

### Task 3: SSE route handler (siglens)

**Files:**
- Create: `src/shared/lib/sse/heartbeatStream.ts`
- Create: `src/__tests__/shared/lib/sse/heartbeatStream.test.ts` (경로는 siglens 컨벤션 확인)
- Create: `src/app/api/analysis/stream/route.ts`
- Reference: `/Users/y0ngha/Project/siglens/src/app/api/sse-probe/route.ts` (검증된 SSE 패턴)

- [ ] **Step 1: heartbeat 스트림 래퍼 구현**

`sse-probe`에서 리뷰로 잡힌 결함을 반드시 반영한다: `setInterval` 콜백에서 `controller.enqueue`가 스트림이 닫힌 뒤 던지면 `clearInterval`에 도달하지 못해 타이머가 영구 재발화한다. `closed` 플래그 + try/catch로 흡수하고 모든 종료 경로에서 타이머를 회수한다.

```ts
const HEARTBEAT_INTERVAL_MS = 25_000;
```

25초인 이유를 주석으로 남긴다: ALB idle 60초의 절반 이하 — heartbeat 한 번 유실돼도 버틴다.

- [ ] **Step 2: route handler 구현**

```
POST /api/analysis/stream
body: { type: 'technical' | ..., params: {...} }
```

- `type`으로 core `run*` 디스패치
- 헤더: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-store, no-transform`, `X-Accel-Buffering: no`
- `request.signal`을 `run*`에 전달 — 연결이 끊기면 LLM 호출이 취소된다
- 인증·tier·BYOK는 기존 `byokGate` 로직 재사용 (재구현 금지)
- `export const dynamic = 'force-dynamic'`

- [ ] **Step 3: 테스트**

heartbeat 타이머 회수, abort 전파, 에러 이벤트 형태를 검증한다.

- [ ] **Step 4: 커밋**

`feat: 분석 SSE 엔드포인트 추가`

---

### Task 4: 차트 탭 전환 + 실증 (siglens)

**Files:**
- Create: `src/shared/hooks/useAnalysisStream.ts`
- Modify: `src/views/symbol/hooks/useAnalysis.ts`

13개를 한 번에 바꾸지 않는다. 차트 탭 하나를 전환해 dev 서버에서 실제로 동작하는지 확인한 뒤 나머지를 따른다.

- [ ] **Step 1: 공통 SSE 소비 훅 구현**

`fetch` + `ReadableStream` 기반. `EventSource`는 POST를 못 보내므로 쓰지 않는다.

- [ ] **Step 2: `useAnalysis` 전환**

반환 타입과 에러 문구를 유지한다 — UI 변경은 범위 밖이다.

- [ ] **Step 3: dev 서버 실증**

```bash
yarn dev
```

브라우저에서 심볼 페이지를 열고 분석을 실행해 SSE 이벤트 수신과 완주를 확인한다.

- [ ] **Step 4: 커밋**

`feat: 차트 분석을 SSE로 전환`

---

### Task 5: 나머지 12개 use-case 전환

Task 2와 Task 4의 패턴을 반복한다. core `run*` 12개 + siglens 훅 5종 + `poll*Action` 제거.

대상: overall, fundamental, financials, news, newsCard, marketNewsDigest, options, congress, briefing, macroBriefing, economicEvent, indicatorTranslation

- [ ] 각 use-case마다: `run*` 작성 → 테스트 → 소비자 전환 → 커밋

**overall 주의:** `resolveOverallDependencies`가 `pendingJobs`를 반환하고 클라이언트가 각각 폴링한 뒤 다시 overall을 제출하는 2단 루프였다. 서버 안 `await Promise.all([...])` 하나로 접힌다.

---

### Task 6: core 정리 + 릴리스

- [ ] `submit*` 13개, `poll*` 13개, `infrastructure/jobs/**`, `application/workerDispatch.ts`, `cancelAnalysisJob.ts` 삭제
- [ ] `src/index.ts`에서 해당 export 제거
- [ ] 전체 게이트: `yarn test` / `yarn typecheck` / `yarn lint` / `yarn build`, 커버리지 90%+
- [ ] main 병합 후 `yarn release` — **태그는 `git push origin refs/tags/vX.Y.Z`로 push**해야 publish 워크플로가 돈다 (API로 만든 ref는 안 켜짐)

---

### Task 7: siglens 정리 + env 제거

- [ ] 삭제: `shared/config/pollingConfig.ts`, `shared/lib/cancelJobsApi.ts`, `app/api/jobs/cancel/route.ts`, `poll*Action` 10개
- [ ] core 버전 핀을 Task 6의 새 버전으로 올리고 `yarn install`
- [ ] `WORKER_URL`/`WORKER_SECRET` 제거: `.env.local`, SSM, `infra/aws/check-env.sh`, `05-launch-template.sh`, `Dockerfile`, `deploy.yml`
- [ ] provider 키 추가: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`
- [ ] `grep -rn "WORKER_URL\|WORKER_SECRET\|pollAnalysis\|submitAnalysis" src/ infra/` 결과 0 확인

---

### Task 8: trader 전환

**Files:** `lib/analysis/run-technical.ts`

- [ ] `submitAnalysis` → `pollUntilDone` 루프를 `runAnalysis` 한 번의 `await`로 교체
- [ ] 크론이라 브라우저 대기가 없으므로 SSE 불필요
- [ ] env: `WORKER_URL`/`WORKER_SECRET` 제거, provider 키 추가

---

### Task 9: worker 아카이브

**모든 검증이 끝난 뒤 마지막에** 수행한다.

- [ ] `siglens-worker` 레포 아카이브
- [ ] Cloud Run 서비스 삭제

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 태스크 |
|---|---|
| `submit*`+`poll*` → `run*` | Task 2, 5 |
| Redis job 키 제거 | Task 6 |
| `workerDispatch` 제거 | Task 6 |
| `cancelAnalysisJob` 제거 (SSE abort로 대체) | Task 6 |
| SSE route handler 1개 | Task 3 |
| heartbeat 25초 + 타이머 회수 | Task 3 Step 1 |
| 폴링 훅 6종 제거 | Task 4, 5 |
| `pollingConfig.ts` 제거 | Task 7 |
| in-flight dedupe | Task 1 |
| 봇/SSR/크론은 SSE 미사용 | Task 2(서버 내부 await) |
| env 교체 | Task 7, 8 |
| trader 전환 | Task 8 |
| worker 아카이브 | Task 9 |
| 롤백 가능성 | Task 2 Step 6(submit/poll 잔존), Task 6에서만 삭제 |

**2. Placeholder 스캔**

Task 5는 12개를 열거만 하고 각각의 코드를 싣지 않는다 — Task 2·4가 패턴을 완전히 정의하고 12개가 그 반복이므로 의도적이다. 실행 시 Task 2를 참조 구현으로 삼는다.

**3. 타입 일관성**

`dedupeInFlight(key, run)`(Task 1) ↔ Task 2에서 `dedupeInFlight(cacheKey, () => callAnalysisAi(...))`로 호출. `CallAnalysisAiOptions`(Spec A) ↔ Task 2의 호출 인자 일치. `options.signal` 추가가 Task 2와 Task 3에서 일관.
