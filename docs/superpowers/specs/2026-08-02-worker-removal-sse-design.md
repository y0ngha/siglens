# Spec B — worker 제거 + Redis job 신호 제거 + SSE 전환

- 날짜: 2026-08-02
- 대상 레포: `siglens-core`, `siglens`, `siglens-trader`, `siglens-worker`(삭제)
- 선행: Spec A (`2026-08-02-analysis-ai-provider-core-promotion-design.md`)

## 배경 — 실측으로 확정된 전제

SSE로 브라우저 요청 안에서 LLM 완료까지 대기하는 것이 가능한지를
`/api/sse-probe`(v0.50.1)로 프로덕션 실측했다.

| 측정 | 결과 |
|---|---|
| 침묵(heartbeat 없음) | **61.1초에 끊김** — HTTP/2 `INTERNAL_ERROR`, 524 아님 |
| 30초 heartbeat / 150초 | 완주, drift 581~613ms 일정 |
| 5초 heartbeat / 150초(30개) | 완주, **뭉침 0건** |
| 30초 heartbeat / 280초 | 286초 완주 |

두 가지가 확정됐다:

1. **진짜 벽은 CF 125초가 아니라 ALB `idle_timeout` 60초다.** CF는 125초를
   지나 286초까지 그대로 흘려보냈다. ALB는 최대 4000초까지 우리가 올릴 수
   있으므로 통제권이 우리에게 있다.
2. **CF의 `text/event-stream` 버퍼링은 이 존에서 발생하지 않는다.**

## 목표

`siglens`·`siglens-trader`가 worker를 의존하지 않고, Redis를 job 신호로
폴링하지 않는 구조. 분석 캐시·quote 캐시·쿨다운·챗 토큰스토어·ISR 태그스토어의
Redis는 **그대로 유지한다** — 걷어내는 것은 job 신호뿐이다.

## 아키텍처

```
AS-IS:
  siglens ─submit─→ Redis(meta) ─POST─→ worker ─LLM─→ Redis(status/result)
  siglens ←──────── 폴링(5~30초 간격) ────────────────┘

TO-BE:
  브라우저 ─SSE(25초 heartbeat)─→ siglens ─await─→ LLM
                                      └→ 분석 캐시(Redis) write
```

heartbeat는 **25초**로 둔다. ALB idle 60초의 절반 이하라 한 번 유실돼도
버틴다. ALB 설정은 변경하지 않는다 — 인프라 변경 없이 성립하는 게 실측 결론이다.

## core 변경

### `submit*` 13 + `poll*` 13 → `run*` 13

`submit`의 1~5단계는 그대로 두고 6~8만 바꾼다. `poll`의 후처리는 `run`으로 이사한다.

```ts
// AS-IS submitAnalysis
1. tier/timeframe 게이트
2. 분석 캐시 확인 → hit면 cached 반환
3. isBot이면 miss_no_trigger
4. fetchBarsWithIndicators
5. 프롬프트 빌드
6. jobId 생성 + setJobMeta          ← 삭제
7. dispatchWorkerJob (fire-and-forget) ← 삭제
8. { status:'submitted', jobId }       ← 삭제

// TO-BE runAnalysis
1~5 동일
6. const raw = await callAnalysisAi({ prompt, model, signal, ... })   // Spec A
7. postProcess → enrich → filter   (poll에서 이사)
8. 캐시 write
9. { status:'done', result }
```

`meta`(symbol/timeframe/lastClose)를 Redis에 왕복시킬 이유가 사라진다 —
같은 함수 스코프의 지역변수가 된다.

**`run*`는 진행 이벤트를 내지 않는다.** Promise 하나만 반환한다. heartbeat는
siglens route handler가 자체 타이머로 찍으므로 core가 진행률을 알 필요가 없다.

### overall 단순화

`resolveOverallDependencies`가 `pendingJobs`를 반환하고 클라이언트가 각각
폴링한 뒤 다시 overall을 제출하는 2단 루프가 서버 안 `await Promise.all([...])`
하나로 접힌다.

### 삭제

- `infrastructure/jobs/**` 전부 (`queue.ts` `redis.ts` `types.ts`)
- `application/workerDispatch.ts`
- `application/market/cancelAnalysisJob.ts` — SSE는 연결이 끊기면 `AbortSignal`이
  전파되므로 별도 취소 경로가 불필요하다
- `poll*` 13개
- `readWorkerConfig` 및 `WORKER_URL`/`WORKER_SECRET` 참조 전부

### in-flight 중복 제거

같은 캐시키에 동시 요청이 오면 LLM을 중복 호출한다. 프로세스 로컬 Map으로 막는다.

```ts
// ponytail: 프로세스 로컬 Map. ASG desired=1이라 실질 위험 낮고,
// 최악이 "LLM 1회 중복"이다. 다중 인스턴스에서 중복이 관측되면 Redis 락으로 승격.
const inFlight = new Map<string, Promise<T>>();
```

## siglens 변경

### SSE Route Handler — 하나만

`/api/analysis/stream` 한 개. 13개 라우트를 만들지 않는다.

```
POST /api/analysis/stream
body: { type: 'technical' | 'overall' | 'news' | ..., params: {...} }

event: heartbeat        ← 25초마다
data: {"status":"done","result":{...}}
```

- `type`으로 core `run*`에 디스패치
- 응답 헤더: `Content-Type: text/event-stream`,
  `Cache-Control: no-cache, no-store, no-transform`, `X-Accel-Buffering: no`
- `request.signal`을 core `run*`에 그대로 전달 — 연결이 끊기면 LLM 호출이 취소된다
- 인증·tier·BYOK 게이팅은 기존 서버 액션(`byokGate`)의 로직을 재사용한다

**타이머 정리**: heartbeat `setInterval`은 스트림이 닫힌 뒤 `enqueue`가 던지면
`clearInterval`에 도달하지 못한 채 콜백을 빠져나가 영구 재발화한다.
`closed` 플래그 + try/catch로 흡수하고 모든 종료 경로에서 타이머를 회수한다
(`/api/sse-probe` 리뷰에서 실제로 잡힌 결함).

### 클라이언트

- 공통 SSE 소비 훅 하나(`useAnalysisStream`)를 만들고, 기존 훅 6종이 그것을 래핑한다.
  각 훅의 반환 타입·에러 문구는 유지한다 — UI 변경은 이 스펙의 범위 밖이다.
- 삭제: `shared/config/pollingConfig.ts` 전부, `shared/lib/cancelJobsApi.ts`,
  `/api/jobs/cancel` 라우트, `poll*Action` 서버 액션 10개

### 봇 / SSR / 크론

SSE를 쓰지 않는다. 서버 내부에서 `run*`를 직접 `await`한다. 브라우저 요청이
없으므로 CF·ALB 타임아웃과 무관하다. `isBot` → `skipEnqueueIfMiss` 동작은
그대로 유지한다(봇에게 LLM을 태우지 않는다).

### env 제거

`WORKER_URL` `WORKER_SECRET` 제거. 분석용 provider 키
(`ANTHROPIC_API_KEY` `GEMINI_API_KEY` `OPENAI_API_KEY` `DEEPSEEK_API_KEY`) 추가.
`.env.local`·SSM·`check-env.sh`·`05-launch-template.sh`·Dockerfile 모두 반영.

## trader 변경

`lib/analysis/run-technical.ts`의 `submitAnalysis` → `pollUntilDone` 루프를
`runAnalysis` 한 번의 `await`로 교체한다. 크론이라 브라우저 대기가 없으므로
SSE가 필요 없다. `WORKER_URL`/`WORKER_SECRET` env 제거, provider 키 추가.

## worker

전 작업 완료 후 레포 아카이브. Cloud Run 서비스 삭제.

## 검증

1. 단위/통합 테스트 — 커버리지 90%+
2. worker env를 제거한 dev 서버에서 Chrome 스모크 테스트 (SSE 수신, 분석 완주)
3. e2e 스위트 통과

## 롤백

core를 이전 버전으로 되돌리고 siglens의 core 핀을 낮추면 worker 경로가 복구된다.
worker 레포 아카이브는 **모든 검증이 끝난 뒤 마지막에** 수행한다.
