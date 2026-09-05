# 분석 이력 참조 기능 — 진행 상태

스펙: `docs/superpowers/specs/2026-09-02-analysis-history-context-design.md`
(siglens 레포 master에 커밋 안 됨 — 워킹트리 파일. 사본:
`/private/tmp/claude-501/-Users-y0ngha-Project-siglens/f65d6707-5012-4cf5-b767-2d0c81e60b83/scratchpad/ANALYSIS_HISTORY_SPEC.md`)

## 규칙
- 순서 엄수: core → siglens → trader (병렬 금지)
- 각 레포: 워크트리 분리, subagent-driven-development
- PR 전: review-agent + 배포 안정성 감사 → findings 0 될 때까지 수정/감사 반복
- core는 CI 성공 후 publish → siglens/trader가 그 버전 적용 후 PR
- siglens/trader가 core보다 먼저 끝나면 PR 올리지 말고 대기

## 상태

### 0. 준비 — 완료
- [x] core 워크트리 `~/Project/siglens-core-history` (feat/prior-analysis-context, base main@0aa5895 v0.54.0). tsc 통과 확인
- [x] siglens 워크트리 `~/Project/siglens-history` (feat/analysis-history, base master@8a0b8c564 v0.69.1). node_modules core=0.54.0 일치
- [x] trader 워크트리 `~/Project/siglens-trader-history` (feat/analysis-history, base main@68226d3 v0.28.5). node_modules core=0.50.2 일치

세 워크트리 모두 node_modules가 자동으로 채워졌다(직접 cp 불필요). 버전 핀 일치 확인 완료.

### core 태스크 분할 (SDD, 순차)
- T1 `src/domain/analysis/priorAnalysis.ts` — PriorAnalysis 타입, PRIOR_ANALYSIS_LIMIT/SLACK,
  `selectPriorAnalyses(candidates, bars)` = 21봉 앵커 → 봉 접기 → 최신 7건. **TTL/timeframe 안 받는다**
- T2 다이제스트 렌더 + 봉에서 결과 계산 + 가드레일 상수
- T3 technical `buildAnalysisPrompt` 주입 (11번째 인자, fearGreed 직후)
- T4 overall `buildOverallAnalysisPrompt` 주입
- T5 캐시 키 축 `historyFingerprint` + 1단계 좁히기(현재 TTL 창 제외 + 최신 21건 + 지문)
  + PROMPT_TEMPLATE_VERSION p8→p9 — 전부 `src/infrastructure/cache/config.ts`
- T6 `SubmitAnalysisOptions.priorAnalyses` + runAnalysis/runOverallAnalysis 배선 + analysisHistoryQuery + index.ts export

각 태스크: implementer → spec reviewer → code quality reviewer. 커밋은 git-agent에게(레포 CLAUDE.md 규칙).

### 1. siglens-core
- [x] 구현 (SDD) — T1~T6 전부 완료
- [x] 코드 리뷰 (blocking 2건 반영 후 통과)
- [x] 배포 안정성 감사 0건 (4회차)
- [x] PR — https://github.com/y0ngha/siglens-core/pull/187 (커밋 `62f0f1c`, 푸시 실물 확인)
- [x] CI 성공 (`ci: pass` 1m39s, `claude-review: pass`)
- [x] claude-review **APPROVED** (6라운드, `42d9463`)
- [x] 머지 완료 (2026-09-03T00:44:27Z, 일반 merge)
- [x] publish success + tarball 실물 확인 (`dist-tags.latest = 0.55.0`)
- [x] publish 태그 push 완료 — `v0.55.0` (`yarn release:minor --ci`, release-it가 태그·GitHub 릴리스까지)

### 2. siglens — 감사 0건, PR 진행 중
- [x] core 버전 bump 0.54.0 → **0.56.0**
- [x] 구현 (SDD) — S1~S4 전부 완료
- [x] 배포 안정성 감사 **0 findings (2회차, READY TO SHIP)**
- [ ] review-agent 0건
- [ ] 배포 안정성 감사 0건
- [ ] PR

### 3. siglens-trader — 감사 0건, PR 진행 중
- [x] core 버전 bump **0.50.2 → 0.56.0** (6버전 점프, 회귀 0)
- [x] 구현 (SDD)
- [x] 배포 안정성 감사 **0 findings (3회차, READY TO SHIP)**
- [ ] PR

## 로그
- 2026-09-02: 설계 확정, 진행 시작

## 설계 정정 (2026-09-02, T1 escalation에서 발견)

**초안 §4-5 결함**: 캐시 키는 캐시 조회 *전*에 계산되는데 `bars`는 캐시 미스 *후*에
페치된다. 봉 앵커로 고른 집합의 지문을 키에 넣는 설계는 성립 불가.

**수정 — 2단 좁히기** (레이어 경계와 정확히 일치):

| 단계 | 레이어 | 입력 | 하는 일 |
|---|---|---|---|
| 1 키용 | infrastructure `cache/config.ts` | priorAnalyses, timeframe, now | 현재 TTL 창 제외 → 최신 21건 → 지문 |
| 2 프롬프트용 | domain `priorAnalysis.ts` | 1의 결과, bars | 봉 앵커 → 봉 접기 → 최신 7건 |

`src/domain/**`의 `@/infrastructure/*` import는 ESLint **error**(eslint.config.mjs).
그래서 도메인은 TTL을 못 읽고, 위 분할이 그 제약과도 맞는다.

**실측 확인된 타입**: `Bar.time`은 초 단위 Unix 타임스탬프(number). Date/ISO 아님.
`PriorAnalysis.generatedAt`은 Date → 비교마다 단위 변환 필요(최대 결함 후보).

스펙 문서에 반영 완료(`docs/superpowers/specs/2026-09-02-analysis-history-context-design.md` §3-1, §4-5).

## core 코드 앵커 (재조사 금지 — 실측 확인됨)

- `Bar.time` = 초 단위 Unix number (`src/domain/types.ts:255`). `Trend` 964행, `RiskLevel` 1064행, `Timeframe` 4행
- `ANALYSIS_CACHE_TTL` = `src/infrastructure/cache/config.ts:57`, Record<Timeframe, number>, **초**
- `PROMPT_TEMPLATE_VERSION = 'p8'` = `config.ts:338` → p9로 bump
- `buildAnalysisCacheKey` = `config.ts:~390-404`. 접미 헬퍼: `reasoningKeySuffix`(165)
  `localeKeySuffix`(179) `positionKeySuffix`(195). 조립: base → skillFingerprint → reasoning → position → locale
- 지문 해시는 `hashAnalysisInput(serialized)` 재사용 (`src/infrastructure/hash/analysisInput.ts:25`)
- `buildAnalysisPrompt` = `src/domain/analysis/prompt.ts:1840`. `dynamicSections` 배열 끝부분:
  … fearGreed → positionHint(빈 문자열이면 스킵) → analysisRequest(꼬리). 이력 섹션은 fearGreed 직후
- `buildOverallAnalysisPrompt` = `src/domain/analysis/overallPrompt.ts:397` (인자 12개, 끝이 locale)
- `runAnalysis`의 `buildAnalysisPrompt` 호출부 = `src/application/market/runAnalysis.ts:260`
- 테스트 위치 관례: `src/__tests__/domain/analysis/<name>.test.ts` (소스 옆 아님)
- 프롬프트 섹션 본문은 **영어**. 로케일은 출력 언어 계약(`outputLanguageContract` 등)으로만 처리.
  `formatPositionHintSection`이 한국어인 건 i18n 이전 잔재
- domain은 `@/infrastructure/*`·`@/application/*` import 금지 (ESLint **error**)
- 커밋 금지 규칙: 각 레포 CLAUDE.md가 커밋을 git-agent에 위임 → implementer는 워킹트리에만 남긴다

## 리뷰 정책 (예산 고려)
태스크마다 2단 리뷰 대신 **2개 묶어서 1회 통합 리뷰**(spec 준수 + 코드 품질).
PR 직전에는 사용자 요구대로 review-agent + 배포 안정성 감사를 findings 0까지 루프.

## core 태스크 진행 로그

- **T1 완료** — `src/domain/analysis/priorAnalysis.ts` + `src/__tests__/domain/analysis/priorAnalysis.test.ts`.
  독립 검증: tsc 0 / 11 테스트 통과 / eslint --max-warnings=0 통과.
  `barTimeMs()` 단일 변환점으로 초↔밀리초 처리.
- **T2 완료** — `src/domain/analysis/priorAnalysisSection.ts` + 테스트 13개.
  `PRIOR_ANALYSIS_GUARDRAIL` 상수 + `formatPriorAnalysisSection(selected, bars, symbol, timeframe)`.
  부수 변경: `prompt.ts`의 `TIMEFRAME_LABEL`에 `export` 추가(맵 중복 방지).
  독립 검증: tsc 0 / 도메인 전체 1635 테스트 통과 / lint 0.
  implementer 자진 신고 2건: (a) `percentFrom`의 close=0 나눗셈 무방비, (b) "stop not breached" 문구는 추론.
- **T1+T2 리뷰 완료** — Stage1 spec PASS / Stage2 품질 APPROVED, blocking 0, non-blocking 3.
  3건 전부 인라인 반영: (a) `MS_PER_SECOND` 사용 통일, (b) `barTimeMs`·`findAnchorBarIndex`를
  `priorAnalysis.ts`로 통합 후 section이 import(앵커 조회 로직 이중 정의 제거),
  (c) `percentFrom`에 `reference === 0` → `'n/a'` 가드(형제 모듈 선례 있으나 0 대입은
  거짓 판독이라 부재로 표기). 반영 후 tsc 0 / 1635 테스트 / lint 0 재확인.
- **T3+T4 완료** — technical `buildAnalysisPrompt`에 11번째 인자 `priorAnalyses?`,
  overall `buildOverallAnalysisPrompt`에 13/14번째 인자 `bars?`, `priorAnalyses?`.
  technical 삽입 위치 = fearGreed 직후 · positionHint 직전. overall 삽입 위치 =
  `axisScoreSection` 직후 · `## Output Schema` 직전(fearGreedBlock이 Axis 1 안에 박혀 있어
  그 직후는 문서 중간이 된다 — implementer 판단 수용).
  테스트 16개 추가(생략 시 **바이트 동일** 대조, stable 미오염, 이력이 스킬 선택 불변).
  **순환 import 해소**: `TIMEFRAME_LABEL`을 `prompt.ts` → `promptFormat.ts`(무의존 모듈)로 이동.
  prompt.ts ⇄ priorAnalysisSection.ts 사이클 제거. 이동 후 도메인 전체 3006 테스트 통과 / tsc 0 / lint 0.
- **T5+T6 완료** — 인프라 캐시 키 + 애플리케이션 배선 + public API.
  `narrowPriorAnalysesForCacheKey(priorAnalyses, currentWindowSeconds, now)`,
  `historyKeySuffix`, `analysisHistoryQuery(timeframe, tab)`,
  `buildAnalysisCacheKey`에 `historyFingerprint?` 마지막 인자, `PROMPT_TEMPLATE_VERSION` p8→p9.
  overall은 `buildOverallCacheKey` 시그니처 불변 — 지문을 inputHash 객체에 `ph` 키로 접어 넣음.
  `runOverallAnalysis`에 봉 페치(step 8b) 추가, F&G 페치와 동일한 `.catch` 실패 자세.
  `src/index.ts`: `type PriorAnalysis` + `analysisHistoryQuery`만 export
  (`PRIOR_ANALYSIS_LIMIT/SLACK`은 의도적 미노출 — 소비자는 `analysisHistoryQuery`만 쓰면 됨).
  `docs/PUBLIC_API.md` 갱신.
- **core 전체 게이트 통과**: `yarn typecheck` 0 / `yarn lint` 0 warning / `yarn test` **220 파일 3919 테스트 전부 통과**
- **1차 시도(2026-09-02 심야): 세션 한도로 review-agent·감사 둘 다 보고 전 사망.**
  워크트리는 무손상(둘 다 read-only). 한도 리셋 후 2026-09-03 재실행.
- **review-agent + 배포 안정성 감사 재실행 중** (findings 0까지 루프)

### core 변경 규모
15개 수정 + 4개 신규, +1233 / -25

### 워킹트리 현황 (커밋 없음)
```
 M src/domain/analysis/prompt.ts          (TIMEFRAME_LABEL export 한 줄)
?? src/domain/analysis/priorAnalysis.ts
?? src/domain/analysis/priorAnalysisSection.ts
?? src/__tests__/domain/analysis/priorAnalysis.test.ts
?? src/__tests__/domain/analysis/priorAnalysisSection.test.ts
```

### IDE 진단 오탐 주의
`Cannot find module '@/domain/analysis/...'` 진단이 뜨지만 **오탐**이다 — 진단기가
프로젝트 루트를 siglens로 잡는다. 워크트리에서 `yarn tsc --noEmit -p tsconfig.json`은
exit 0. 이 진단으로 코드를 고치지 말 것.

### overall 관련 실측 (T4 전제)
`buildOverallAnalysisPrompt`에는 `bars`가 **없다**(인자 12개: symbol, companyName,
technical, fundamental, news, timeframe, fearGreed, options, optionsOiStale,
financials, assetClass, locale). 봉 앵커를 쓰려면 `bars`를 새 인자로 받아야 한다.

추가 페치 비용은 없다 — `fetchBarsWithIndicators`가 자체 캐시(`computeBarsEffectiveTtl`)를
갖고, `runOverallAnalysis`는 이미 `runAnalysisForOverall`을 통해 같은 심볼·타임프레임의
봉을 페치한 뒤다. 그래서 T6에서 `runOverallAnalysis`가 같은 호출을 한 번 더 해도
실질 캐시 히트다. (초안에서 "overall도 봉이 있다"고 적은 건 틀렸고, 이 경로로 해결)

### T5/T6 설계 확정 (실측 기반, 2026-09-02)

**overall 캐시 키는 새 축이 필요 없다.** `buildOverallCacheKey(symbol, timeframe,
modelId, inputHash, reasoning, locale)`가 이미 `inputHash`를 받고, 호출부
(`runOverallAnalysis.ts:433` 직전)가 `{n: newsData, o: stableOptions, fin: ...}`를
해싱해 넘긴다. overall 이력 지문은 **그 객체에 키 하나 추가**로 끝난다.
technical(`buildAnalysisCacheKey`)만 새 접미 세그먼트가 필요하다.

**창 길이가 축마다 다르다.** `ANALYSIS_CACHE_TTL[tf]`는 타임프레임별(5분~1일)인데
`OVERALL_CACHE_TTL_SECONDS = SECONDS_PER_DAY`로 타임프레임 무관 고정이다.
따라서 좁히기 함수는 timeframe이 아니라 **초 단위 창 길이**를 받는다:

```ts
narrowPriorAnalysesForCacheKey(
    priorAnalyses, currentWindowSeconds, now
): { candidates: PriorAnalysis[]; fingerprint: string }
```
호출부가 `ANALYSIS_CACHE_TTL[tf]`(technical) 또는 `OVERALL_CACHE_TTL_SECONDS`(overall)를 넘긴다.

**소비자 헬퍼**: `analysisHistoryQuery(timeframe, tab)` — tab이 필요하다. overall은
TTL이 1일 고정이라 1Hour여도 21일치를 긁어야 하고, technical 창(21시간)을 쓰면 굶는다.

**T6 배선 지점**
- `SubmitAnalysisOptions`에 `priorAnalyses?: readonly PriorAnalysis[]` 추가 (`src/application/market/types.ts:126` 근처, positionBucket 다음)
- `runAnalysis.ts:182` `buildAnalysisCacheKey` 호출에 지문 추가
- `runAnalysis.ts:260` `buildAnalysisPrompt` 호출에 candidates 추가 (locale 다음)
- `runOverallAnalysis.ts:433` 직전 inputHash 객체에 지문 키 추가
- `runOverallAnalysis.ts:488` `buildOverallAnalysisPrompt` 호출에 bars + candidates 추가
- overall은 `fetchBarsWithIndicators`로 대상 심볼 봉을 받아야 함(캐시 히트)
- `src/index.ts`에 `PriorAnalysis` 타입 + `analysisHistoryQuery` export

## 배포 안정성 감사 1회차 결과 (2026-09-03) — CRITICAL 0 / HIGH 2 / MEDIUM 2

### HIGH-1 `runOverallAnalysis.ts:519-524` — 봉 페치가 무조건 실행 + "캐시 히트" 전제가 거짓
`fetchBarsWithIndicators`(`src/application/market/barsApi.ts`)는 **core에 메모이제이션이 없다** —
`provider.getBars()` 순수 pass-through다. core가 export하는 `computeBarsEffectiveTtl`은
소비자 캐시 레이어용 **TTL 계산기**일 뿐이다. 내가 설계 때 "core가 캐시하니 히트"라고 한 건 틀렸다.
(실제 히트 여부는 주입된 MarketDataProvider 구현에 달림 — siglens는 캐시하지만 core는 보장 못 함)

게다가 `options.priorAnalyses`가 비어도 **모든 overall 캐시 미스마다** 실행된다. 아직 어떤
소비자도 priorAnalyses를 안 넘기므로 당분간 100% 낭비. `calculateIndicators`까지 돌려놓고
`d.bars`만 쓰고 지표는 버린다. F&G 페치와 독립인데 직렬이기도 함.

**수정**: `priorAnalysisCandidates.length > 0`일 때만 페치 + F&G와 `Promise.all`.

### HIGH-2 `priorAnalysisSection.ts:50-56,58-91,114-117` — NaN/Infinity가 프롬프트로 샌다
`formatNullableNumber`는 `== null`만 막는다. `NaN.toFixed(2) === "NaN"` → 프롬프트에 `SL NaN`이
그대로 실려 유료 모델로 간다. 더 나쁜 건 `formatStopWord`: `low <= NaN`이 항상 false라
**실제와 무관하게 항상 "stop not breached"**를 출력한다(쓰레기가 아니라 거짓 판정).
테스트에 NaN/Infinity/음수 케이스 없음.

**수정**: `Number.isFinite()` 가드, 비유한값은 부재 취급 (`percentFrom`의 `reference === 0` → `'n/a'`와 같은 자세).

### MEDIUM-1 `config.ts:485` vs `:783` — fundamental이 PROMPT_TEMPLATE_VERSION을 공유
`buildFundamentalCacheKey`도 같은 상수를 박아서 p8→p9가 fundamental 캐시를 통째로 콜드스타트시킨다
(TTL 1일, 심볼당 13개 병렬 API 호출). fundamental 프롬프트는 한 바이트도 안 바뀌었는데.
**이 diff가 만든 문제는 아니다**(기존 커플링, p7/p8에서도 감수했음). 나머지 축
(financials/congress/news/briefing/economic-event/indicator-translation)은 전부 자기 상수를 갖는다.
→ 어차피 p9로 무효화되는 지금이 분리 비용 0인 유일한 타이밍. 분리하기로 결정.

### MEDIUM-2 소비자 배열 크기 무제한
`analysisHistoryQuery`가 21로 캡을 주지만 강제는 아님. 소비자가 limit을 안 걸면 무제한 배열에
O(n log n) 정렬이 매 요청 돈다. 실현 가능성 낮음. → JSDoc에 계약 명시.

### 감사가 확인해준 안전 항목 (재검증 불필요)
- `priorAnalyses` 생략 시 양 축 캐시 키 **바이트 동일** (`JSON.stringify`가 `ph: undefined` 키를 버림)
- `dedupeInFlight`는 지문 포함 후의 `cacheKey`로 단일 비행 — 올바름
- 지문의 TTL 창 내 안정성 확인. `ANALYSIS_CACHE_TTL` 정적값 vs `computeEffectiveTtl` 클램프 비대칭은
  **과다 제외** 방향이라 안전
- overall 신규 페치의 인자는 technical 것과 동일(`technicalOptions.fmpSymbol` 같은 출처)
- 두 신규 페치 모두 `.catch`로 degrade, overall을 못 죽임
- 섹션은 `dynamic` 전용, `stable` 미오염 / 이력이 스킬 선택·지문에 영향 없음
- 프롬프트 증가량 최대 ~2-3KB로 유계
- `TIMEFRAME_LABEL`은 main의 `src/index.ts`에 없었음 → 이동해도 소비자 깨짐 0
- 신규 런타임 의존성 0, CHANGELOG·PUBLIC_API 갱신됨, package.json 버전은 태그 푸시 때 올리는 게 관례

## 감사 1회차 수정 완료 (2026-09-03) — 인라인 처리

- **HIGH-1** `runOverallAnalysis.ts` — 봉 페치를 `priorAnalysisCandidates.length > 0`로 게이트,
  F&G 페치와 `Promise.all`로 병렬화. 거짓이던 "core가 캐시한다" 주석을 사실로 교체
  (core는 주입된 provider의 캐시 여부를 가정할 수 없다). `Bar` 타입 import 추가.
  테스트 3개 추가 — **타임프레임 인자로 두 페치를 가르려다 실패했다**: tier 미지정이면
  free로 떨어져 장중 타임프레임이 게이트에 막혀 step 8b 전에 리턴된다. 그래서 '1Day' 유지 +
  **호출 수**(F&G 1회 vs 이력 붙으면 2회)로 판별하도록 고침.
- **HIGH-2** `priorAnalysisSection.ts` — `finitePrice` 추가, `percentFrom`·`formatStopWord`·
  `formatTargetWord`에 `Number.isFinite` 가드(둘은 `string | null` 반환으로 바꿔 조각 자체를 드롭),
  entry/TP 배열은 비유한값 필터, 최근접 목표가는 `[0]`이 아니라 **첫 유한값**. 테스트 7개 추가.
- **MEDIUM-1** `config.ts` — `FUNDAMENTAL_PROMPT_TEMPLATE_VERSION = 'f1'` 신설,
  `buildFundamentalCacheKey`가 이걸 쓰도록 분리. 기존 테스트 3건 갱신 + 재커플링 방지 회귀 테스트 추가.
- **MEDIUM-2** — `narrowPriorAnalysesForCacheKey` JSDoc에 입력 크기 계약 명시.

전체 게이트: typecheck 0 / lint 0 / **220 파일 3930 테스트 통과**(+11).

- **core 완료 ✅ v0.55.0 publish success + tarball 실물 확인. siglens 착수**

### 에이전트 운용 메모
- review-agent(레포 정의)는 출력 137바이트에서 2시간 정지 → TaskStop으로 종료.
  이후 general-purpose 리뷰어로 대체(T1+T2 때 정상 동작했음).
- 감사 중에는 소스 수정 금지. 리뷰어·감사가 동시에 같은 파일을 읽으면 수정이 허위 findings를 만든다.

## 감사 2회차 + 코드 리뷰 결과와 수정 (2026-09-03)

감사 2회차: HIGH-1/MEDIUM-1/MEDIUM-2 수정 확인. **HIGH-2는 절반만 고쳐져 있었다.**
코드 리뷰: CHANGES_REQUESTED, blocking 2 + non-blocking 3 + 실패불가 테스트 2.

### 수정한 것

**(리뷰 blocking #1 — 진짜 설계 결함) `analysisHistoryQuery`가 봉 앵커를 무력화하고 있었다.**
`sinceMs = ANALYSIS_CACHE_TTL[tf] * 21 * 1000`은 **벽시계 창**이라, 봉 앵커로 피하려던 문제를
한 층 위(소비자 SQL)에서 되살렸다. 5Min이면 1.75시간 → 전 세션 마감 분석(~17.5시간 전)이
소비자 쿼리에서 잘려 `selectPriorAnalyses`가 아예 못 본다. 매일 개장 후 몇 시간 동안
기능이 조용히 아무것도 안 하는 상태.

수정: `sinceMs = TIMEFRAME_LOOKBACK_DAYS[tf] / TIMEFRAME_BARS_LIMIT[tf] * 21` 달력일.
5Min 17.5h / 1Hour 6.3일 / 1Day 30.7일. **`tab` 파라미터 제거** — overall의 1일 최신성 제외는
core 1단계가 하지 소비자 쿼리가 하는 게 아니라서, 두 축이 같은 창을 쓴다.

**(감사 2회차 HIGH) 봉 파생 NaN.** `high`/`low`/`now`가 `finitePrice`를 안 거쳐
`high NaN`이 프롬프트로 갔다. 하나라도 비유한값이면 `-> since:` 줄을 통째로 생략(헤더만).

**(blocking #2 + 감사 MEDIUM) 거짓 문서 3곳.** `overallPrompt.ts` JSDoc과 `PUBLIC_API.md` 2곳이
1회차에 반증된 "fetchBarsWithIndicators는 캐시되니 실질 히트"를 그대로 유지. 전부 정정 —
캐시 없음/게이트 필수 명시. `AnalysisResponse`에 원본 봉이 없어 재사용 자체가 불가능하다는 것도 기재.

**(non-blocking)** `narrowPriorAnalysesForCacheKey` JSDoc의 "stage 2가 필요할 엔트리를 절대 안 버린다"는
과장 — 캡이 **개수** 기준이라 한 봉에 분석이 몰리면 21건이 그 봉들로 다 차서 stage 2가 굶을 수 있다
(데이터가 틀리는 게 아니라 섹션이 짧아짐). 정확하게 완화. JSDoc 정렬 2곳.

**(실패불가 테스트 2건)**
- `analysisHistoryQuery` 테스트가 구현 공식을 같은 상수로 재계산 → 잘못된 사이징에도 통과했다.
  의미론적 하한으로 교체(5Min > 17.5h, 1Day > 29일, 단조 증가, TTL 사이징 회귀 가드).
- overall 게이팅 테스트가 호출 수만 세서 **봉이 프롬프트까지 배선됐는지** 검증 못 함
  (목이 `bars: []`라 섹션이 어차피 안 그려짐). 실물 봉 리턴 + `## Prior Analyses` 단언 테스트 추가.

전체 게이트: typecheck 0 / lint 0 / **220 파일 3937 테스트 통과**.

## 감사 3회차 결과와 수정 (2026-09-03)

A(봉 파생 NaN 가드)·C(거짓 문서)·D(과장 보증)·E(배선 테스트) 확인. **B는 여전히 깨져 있었다.**

### HIGH — `analysisHistoryQuery` 창이 여전히 부족 (같은 결함 3번째 발현)
2회차 수정(달력일/봉 비율)은 방향은 맞았지만 **평균**을 썼다. 문제는 최악 갭이다.
- 5Min 17.5h인데 금요일 마감→월요일 개장 **65.5h**, 연휴 월요일이면 **89.5h**
- 15Min 50.4h, 30Min 75.6h도 같은 방식으로 실패
- 즉 "매일 개장 후 몇 시간"에서 "**매주 월요일 하루 종일**"로 위치만 옮겨간 것
- 내 테스트 하한(17.5h)이 스스로 명시한 시나리오(17h35m)보다 느슨해서 구현이 **1ms 차이로** 통과하고 있었다

**수정**: `HISTORY_WEEKEND_SAFETY_FACTOR = 1.5` 곱 + `MAX_MARKET_CLOSURE_DAYS = 5` 오프셋.
짧은 타임프레임은 사실상 이 오프셋이 창을 지탱한다(21개 5분봉은 달력 시간이 거의 0이라).

| tf | 창 |
|---|---|
| 5Min | 6.09일 |
| 15Min | 8.15일 |
| 30Min | 9.72일 |
| 1Hour | 14.45일 |
| 4Hour | 36.5일 |
| 1Day | 51.0일 |

전부 연휴 갭 89.5h를 넉넉히 넘긴다. 과다 페치는 의도된 편향 — coarse 사전 필터라
core가 두 번 다시 자르고, 부족하면 **에러 없이** 기능이 죽는다.

**테스트**: 실측 갭 상수로 교체(`OVERNIGHT_GAP_MS` 17.583h / `WEEKEND_GAP_MS` 65.5h /
`LONG_WEEKEND_GAP_MS` 89.5h). 전 장중 타임프레임이 연휴 갭을 넘는지 단언.

### MEDIUM — `application/overall/types.ts`의 낡은 JSDoc
제거된 2번째 인자 `analysisHistoryQuery(timeframe, 'overall')`를 소비자에게 안내하고 있었다.
따라 하면 TS 인자 초과 에러. 정정.

### 추가로 잡은 것
`PUBLIC_API.md` 체인지로그가 (a) 버퍼 미반영, (b) fundamental 분리 후인데 "technical/fundamental
캐시를 함께 콜드스타트"라고 기재 — 둘 다 정정하고 `FUNDAMENTAL_PROMPT_TEMPLATE_VERSION` 분리 항목 추가.

전체 게이트: typecheck 0 / lint 0 / **3937 테스트 통과**.

## 교훈 (같은 결함이 3층에서 반복됨)
"봉으로 세야 한다"는 규칙을 core 안에서는 지켰는데, **소비자 쿼리 사이징**에서 벽시계로
되돌아갔고, 그걸 고칠 때는 **평균**을 써서 또 틀렸다. 창 계산은 항상 *최악 갭*으로 검증할 것.
그리고 테스트 하한을 구현 공식이 아니라 **실측 시나리오**로 잡아야 이런 게 잡힌다.

## 감사 4회차: findings 0 (2026-09-03)

F(최악 갭 사이징)·G(낡은 JSDoc)·H(체인지로그 정확성) 전부 확인. 신규 findings 없음.
감사가 6개 타임프레임 창을 직접 재계산해 일치 확인, 체인지로그의 모든 사실 주장을 소스와 대조.
회귀 항목(캐시 키 바이트 동일, 지문 안정성, stable 미오염, 비유한값 가드, 게이팅, 의존성 0) 전부 유지.

한 가지 기록해둘 것: 장중 5개 타임프레임은 `MAX_MARKET_CLOSURE_DAYS`(5일=120h)만으로
이미 연휴 갭(89.5h)을 넘어서, `HISTORY_WEEKEND_SAFETY_FACTOR`를 1로 바꿔도 그 테스트는 통과한다.
2회차 이전 공식(5Min 17.5h)에 대해서는 확실히 실패하므로 회귀 가드로는 유효.
코드 주석이 "짧은 타임프레임은 오프셋이 창을 지탱한다"고 이미 밝히고 있어 의도된 느슨함.

**다음**: 커밋 → PR → CI 성공 → `v*` 태그 push로 publish (API 금지, `git push`만) → siglens 착수.

## PR #187 claude-review 지적 (2026-09-03)

체크는 둘 다 pass인데 `reviewDecision`은 **CHANGES_REQUESTED**. (체크 pass ≠ 승인)
전부 레포 규약 위반으로 실재 확인함.

### Blocker
1. `priorAnalysis.ts`의 비-재노출 export 5개에 `@internal` 누락 (MISTAKES.md #9.5).
   파일에 `@internal` 태그가 **0개**였다. 게다가 public JSDoc이 `{@link narrowPriorAnalysesForCacheKey}`를
   참조해 TypeDoc `excludeInternal`에서 깨진 링크가 된다.
2. `PriorAnalysis`가 `domain/types.ts` 밖에 정의 (ARCHITECTURE.md 위반).
   `PUBLIC_API.md`가 `PatternTrend`를 선례로 들었는데 그건 **한 줄 별칭**이라 다중 필드 인터페이스 선례가 못 된다.
3. `selectPriorAnalyses`의 `if (barKey === null) continue;`가 도달 불가 방어 분기 →
   테스트 불가. 이 레포는 domain/infrastructure 100% branch coverage 요구.
4. `formatPriorAnalysisSection`에 `@internal` 누락 (같은 파일 `PRIOR_ANALYSIS_GUARDRAIL`엔 있어서 파일 내 불일치).
5. `narrowPriorAnalysesForCacheKey` `@internal` 누락 + 인라인 객체 반환 타입 →
   `infrastructure/cache/types.ts`에 named interface로.
6. `analysisHistoryQuery`도 인라인 반환 타입 — **공개 Tier 3**라 소비자 IDE에 익명 타입이 뜬다.
7. `runOverallAnalysis`의 `as Promise<FearGreedSnapshot | null>`에 설명 주석 없음 (MISTAKES.md TS #7).
   `Promise.all`로 옮기며 새로 생긴 캐스트 — 애초에 제거 가능한지 먼저 확인 지시.

### Suggestion
- `findAnchorBarIndex`가 정렬 배열을 선형 역스캔 → CONVENTIONS.md는 binary search 권장
- `promptFormat.ts` 주석이 자기모순("no imports"라면서 같은 diff에서 `Timeframe` import 추가)

→ Sonnet 서브에이전트로 반영 중. 반영 후 재리뷰 트리거(Draft 토글) → APPROVED 확인 → 머지 → `v*` 태그 push.

## PR #187 리뷰 지적 반영 완료 (2026-09-03, 커밋 `f45e2d0`)

| 지적 | 처리 |
|---|---|
| B1·B4·B5 `@internal` 누락 | 7개 심볼에 태그. public JSDoc의 `{@link}` 깨짐 0 확인 |
| B2 `PriorAnalysis` 위치 | `domain/types.ts`로 이동. `PatternTrend` 선례 주장 삭제 |
| B3 도달 불가 분기 | 제거 |
| B5·B6 인라인 반환 타입 | `infrastructure/cache/types.ts`에 named interface. 공개분은 `index.ts` export |
| B7 `as` 캐스트 | **애초에 불필요했다** — `.then().catch()` 체인이 그대로 추론됨. 제거 |
| S1 선형 역스캔 | binary search + 경계 테스트 5개 |
| S2 자기모순 주석 | 정정 |

게이트: typecheck 0 / lint 0 warning / **220 파일 3942 테스트**(+5).

### ⚠️ claude-review 재실행 규칙 (사용자 지시, 2026-09-03)
- **트리거는 push가 아니라 Draft ↔ Ready 토글**이다. 재푸시만으로는 리뷰가 다시 안 돈다.
- 리뷰 코멘트에 **시스템 한도로 리뷰 실패**가 뜨는 경우에도 같은 토글로 재실행해야 한다.
- `scripts/pr_toggle_ready.sh` 존재. 또는 `gh pr ready --undo 187 && gh pr ready 187`.
- 판정은 체크가 아니라 `gh pr view --json reviewDecision,mergeStateStatus`로.
  (메모리에도 저장: `feedback_claude_review_retrigger_on_system_limit.md`)

## PR #187 리뷰 2라운드 (2026-09-03, 커밋 `00822cc`)

Draft 토글로 재리뷰 → 새 리뷰 제출됨, 여전히 CHANGES_REQUESTED. Blocker 2 + Suggestion 1.

### Blocker 1 — 같은 봉을 두 번 페치 (**내 감사 4회차가 전부 놓친 것**)
Fear & Greed는 항상 `'1Day'`를 부른다. overall 요청 자체가 `'1Day'`면 두 `fetchBarsWithIndicators`
호출의 인자가 **완전히 동일**해지는데 core는 캐시하지 않으므로 같은 업스트림 호출 +
`calculateIndicators`를 두 번 치른다. 테스트 `baseOptions()`도 `'1Day'`라 가장 흔한 경로가 그랬다.

내 감사들은 "게이트가 제대로 걸렸나"만 봤지 **F&G 페치와의 중복**은 보지 않았다.
→ `dailyBarsPromise` 하나를 공유. `timeframe === '1Day'`면 재사용, 아니면 별도 페치.

### Blocker 2 — `FUNDAMENTAL_PROMPT_TEMPLATE_VERSION`에 `@internal` 누락
내가 감사 1회차 수정 때 인라인으로 추가한 상수라 태그를 빠뜨렸다. 형제 상수 6개는 전부 있음.

### Suggestion — `@/domain/analysis/*` import 알파벳 순서 (MISTAKES.md #13.5)

### 테스트 조정
기존 "이력용 봉을 한 번 더 페치한다"가 `'1Day'` 기준이라 이제 1회가 정답 →
`'1Hour'` + `tier: 'pro'`로 옮겨 원래 의미 유지. pro를 안 주면 티어 게이트에 막혀
페치 지점에 **도달조차 못 한다**(같은 함정을 앞서 한 번 밟았음).
`'1Day'` 단일 페치를 고정하는 테스트 신규 추가.

게이트: typecheck 0 / lint 0 / **220 파일 3943 테스트**.

## PR #187 리뷰 3라운드 (2026-09-03)

리뷰 대상 커밋 `00822cc` 확인됨. Blocker 1 + Suggestion 1.

### Blocker — `PriorAnalysis` 필드 JSDoc 누락
`trend`/`riskLevel`/`stopLoss` 3개 필드에 주석 없음. Tier 4 공개 타입은
CONVENTIONS.md가 "one-line per field"를 **Required**로 규정.
타입을 `domain/types.ts`로 옮길 때 세 개만 비었다.

### Suggestion — 내 직전 수정의 부작용: 실패 로그 이중 출력
중복 페치를 없애려고 두 promise가 `dailyBarsPromise`를 공유하게 했는데,
각자 `.catch`를 달아 둬서 **업스트림 실패 1건에 `console.error` 2줄**이 찍혔다.
독립된 두 장애처럼 읽힌다. 로깅을 공유 지점 한 곳으로 이동, 파생 경로는 각자
독립 degrade 유지(`null`/`undefined`). 단일 로그를 테스트로 고정.

게이트: typecheck 0 / lint 0 / **220 파일 3944 테스트**.

## 리뷰어가 검증해준 항목 (재확인 불필요)
레이어 의존 방향 / domain purity(`Date.now`·`fetch`·`console`·`process.env` 부재) /
캐시 키와 렌더된 프롬프트 정합성(동일 `now`·`candidates` 재사용) /
`analysisHistoryQuery` 산식을 직접 재계산해 주말(65.5h)·연휴(89.5h) 갭 초과 및 단조 증가 확인 /
`@internal` 태깅 일관성(공개 `AnalysisHistoryQuery`에는 없고 나머지엔 있음)

## 현재 위치 (세션 끊김 대비)
- core: PR #187 리뷰 루프 중. **APPROVED 전 머지·태그 금지.**
- siglens: 워크트리 `~/Project/siglens-history` 생성됨, **작업 미착수**(순서상 대기)
- trader: 워크트리 `~/Project/siglens-trader-history` 생성됨, **작업 미착수**(순서상 대기)

## PR #187 리뷰 4~5라운드 (2026-09-03)

**4차**: `claude[bot]`이 본문 `"test"` 한 줄짜리 COMMENTED 리뷰를 남김 — 오작동 run.
COMMENTED는 이전 CHANGES_REQUESTED를 해제하지 않으므로 판정 불변. 실제 리뷰가 뒤이어 도착.

**5차** (`24b5eb3` 대상): Blocker 1 + Suggestion 1 — **둘 다 내 인라인 수정이 남긴 흔적**.
- Blocker: `config.ts`에서 `@/domain/constants/market`이 `time` 뒤에 붙어 알파벳 순서 위반
  (MISTAKES.md #13.5, PR #92에서 반복 지적된 항목). `TIMEFRAME_LOOKBACK_DAYS` import 추가 시 발생.
- Suggestion: `runOverallAnalysis.ts`에 같은 5줄 문단 중복. 중복 페치 제거 때 블록을 갈아끼우며
  옛 문단을 안 지웠고, 앞 문단도 dedup 이전 구조를 설명하는 stale 상태였음. 둘 다 정리.

기능 변경 0. 게이트: typecheck 0 / lint 0 / **220 파일 3944 테스트**. 커밋 `42d9463` 푸시 확인.

### 지적 수렴 추이
6+2 → 2+1 → 1+1 → 1+1, 남은 건 전부 주석·import 순서 수준.

### 관찰: 리뷰 라운드마다 내 직전 수정이 새 지적을 만든다
- 중복 페치 제거 → 로그 이중 출력(5차 Suggestion... 실제로는 3차)
- `TIMEFRAME_LOOKBACK_DAYS` import 추가 → 알파벳 순서 위반
- 블록 교체 → 주석 중복
수정할 때 **주변 주석·import까지 함께 정리**해야 라운드가 줄어든다.

## PR #187 APPROVED (2026-09-03, 6라운드)

`decision=APPROVED merge=CLEAN`, 체크 둘 다 pass. **Blocker 0**, Suggestion 4건.

리뷰가 확인해준 것: 도메인/인프라 레이어 경계, 캐시 키 2단계 narrowing 설계,
byte-identical omit 계약, NaN/Infinity 방어, 테스트 커버리지 — "매우 꼼꼼", "훌륭".

### Suggestion 4건 전부 반영
1. `config.ts` import 알파벳 순서 (`cache/types` < `hash/analysisInput`)
2. `PRIOR_ANALYSIS_LIMIT * SLACK`이 세 곳에서 각각 재계산 → `PRIOR_ANALYSIS_WINDOW_BARS` 단일화.
   세 값이 어긋나면(1단계 캡 < 2단계 앵커 창) stage 2가 **조용히** 굶는다.
3. `NarrowedPriorAnalyses.candidates`만 mutable → `readonly` 통일
4. **실제 회귀**: `computeFearGreedIndex`가 `catch` 밖으로 나가 있었다.
   중복 페치 제거로 fetch/compute를 쪼개면서 fetch만 catch를 유지 →
   compute가 throw하면 `Promise.all`이 reject되어 overall 분석 전체가 실패한다.
   **바로 위 내 주석은 "Fear & Greed는 무조건 null로 degrade"라고 약속**하고 있었다.
   현재 호출부가 throw하지 않아 증상만 없었을 뿐. compute 단계에 catch 추가.

게이트: typecheck 0 / lint 0 / **220 파일 3944 테스트**.

### ⚠️ 다음 단계 주의
승인 후 새 커밋을 푸시하므로 **approval이 stale 처리되는지 확인 필요**.
dismiss되면 Draft 토글로 재리뷰 → 재승인 후 머지.
머지 후 릴리스는 `v*` 태그를 **`git push`로만** (API로 만든 ref는 push 이벤트 미발생 → 배포 안 돔).
확인은 `gh run list --workflow=deploy.yml` 또는 publish 워크플로.
publish 성공해도 **tarball 실물 확인 후에** siglens/trader 버전 bump.

## core 릴리스 (2026-09-03)

- PR #187 머지: `68c1e18`, 00:44:27Z, 일반 merge
- 릴리스 전 main 레포 `yarn install` + `.tsbuildinfo` 삭제 (워크트리 작업 후 stale 방지)
- `yarn release:minor --ci` → **v0.54.0 → v0.55.0** (additive라 minor)
  release-it가 package.json bump + CHANGELOG + 커밋 + 태그 + push + GitHub 릴리스까지 수행
- 태그 원격 확인: `180e0104 refs/tags/v0.55.0`
- **publish 워크플로가 push 이벤트로 큐잉됨** (run 33700853182) — API ref였다면 안 돌았을 자리
- 릴리스: https://github.com/y0ngha/siglens-core/releases/tag/v0.55.0

### 다음: publish 성공 후에도 tarball 실물 확인 필수
워크플로 success여도 409 checksum mismatch가 날 수 있고 같은 버전 재발행이 불가하다.
실물 확인 전에는 siglens/trader 버전 bump 금지.
확인법: 소비자 워크트리에서 `yarn npm info @y0ngha/siglens-core@0.55.0` 또는 실제 설치.
Yarn 4.18 `npmMinimalAgeGate`(기본 1일) 때문에 갓 발행한 버전이 "quarantined"될 수 있음 —
인증 문제가 아니라 배포 나이 게이트이고, `npmPreapprovedPackages`로 예외 처리한다.

## core 단계 완료 (2026-09-03)

publish 워크플로 success + **tarball 실물 확인** (`yarn npm info` → `dist-tags.latest = 0.55.0`).
siglens 워크트리 bump 0.54.0 → 0.55.0, `yarn install` 성공, node_modules 0.55.0 확인.
Yarn 나이 게이트(`npmMinimalAgeGate`)는 발동하지 않았다.

신규 API 노출 확인:
- `export type { PriorAnalysis } from './domain/types'`
- `export { analysisHistoryQuery } from './infrastructure/cache/config'`
- `export type { AnalysisHistoryQuery } from './infrastructure/cache/types'`
- `SubmitAnalysisOptions.priorAnalyses` (application/market/types.d.ts:129)
- `OverallDependencyInputs.priorAnalyses` (application/overall/types.d.ts)

## siglens 태스크 분할 (SDD)
- **S1 완료** — `analysis_prompt_blobs` + `analysis_history` + 마이그레이션 `drizzle/0033_analysis_history.sql`.
  DB 접속 없음 확인(생성만). typecheck 0 / lint 0 warning / schema 테스트 29개 통과
- S2 SSE 라우트(`src/app/api/analysis/stream/route.ts`)에 `after()` write 훅
- S3 read + `priorAnalyses` 주입 (technical + overall 2축)
- S4 리텐션 (result 90일 / prompt_dynamic 7일) — 기존 prewarm 크론에 추가

### ⚠️ 서브에이전트에 반드시 명시할 것
`.env.local`이 **운영 Neon**을 가리킨다. 마이그레이션 **생성만** 허용,
`db:migrate`/`db:push` 및 `ALLOW_REMOTE_DB_WRITE` 류 금지. DB 접속 시도가 보이면 중단·보고.

## ⚠️ 설계 공백 발견 → core 2차 릴리스 필요 (2026-09-03)

**core가 조립한 프롬프트를 소비자에게 전혀 노출하지 않는다.**
`RunAnalysisResult = { status, result, lockedInfoDepth } | ...` — prompt 없음.
siglens가 재조립하는 것도 불가능(봉·샘플링된 스킬·게이팅·로케일 전부 core 내부).

즉 S1에서 만든 `prompt_dynamic` / `prompt_stable_hash` / `prompt_system_hash` 컬럼을
**채울 방법이 없다.** 사용자가 "프롬프트도 저장"을 명시적으로 선택했으므로
컬럼을 비워두는 건 그 결정을 조용히 무르는 것 → core에 최소 추가를 넣는다.

### 설계: 결과 필드가 아니라 콜백 옵션
```ts
onPromptAssembled?: (record: AssembledPromptRecord) => void;
// { system, stable, dynamic, promptVersion }
```
- **신규 생성 때만** 발화 — 캐시 히트엔 조립된 프롬프트가 없다.
  결과 필드로 만들면 모든 소비자가 "언제 채워지나"를 따져야 한다.
- 결과 union 불변 → 기존 소비자 영향 0
- 콜백이 throw해도 core가 잡아 로그만 남긴다. 소비자 영속화 실패가 분석을 죽이면 안 된다.

워크트리: `~/Project/siglens-core-promptcap` (브랜치 `feat/prompt-capture-hook`, base main@v0.55.0)
→ 구현 → 감사/리뷰 → v0.56.0 릴리스 → siglens가 그 버전으로 S2 진행.

### 리뷰에서 이미 지적당한 것들 재발 방지 (프롬프트에 선반영함)
- 공개 타입은 `domain/types.ts`에 (feature 파일 밖 배치는 이전에 Blocker였음)
- Tier 4 공개 타입은 **필드별 한 줄 JSDoc** 필수
- `src/index.ts` 미노출 심볼엔 `@internal`, 노출 심볼엔 붙이지 말 것
- path-alias 그룹 내 import 알파벳 순
- 인라인 객체 타입 금지 → named interface

## core v0.56.0 준비 — 프롬프트 캡처 훅 (2026-09-03)

워크트리 `~/Project/siglens-core-promptcap` / 브랜치 `feat/prompt-capture-hook` / base main@v0.55.0

구현 완료: `AssembledPromptRecord`(domain/types.ts) + `onPromptAssembled?` 옵션(양 축) +
runAnalysis·runOverallAnalysis 호출부(try/catch 감쌈) + index.ts export + PUBLIC_API.md.
게이트: typecheck 0 / **lint warning 0** / 220파일 **3952 테스트**(+8).

### 부수 수정: main에 있던 lint warning 2건
승인 후 Suggestion 반영 때 `PRIOR_ANALYSIS_WINDOW_BARS`로 단일화하면서
`PRIOR_ANALYSIS_LIMIT`/`PRIOR_ANALYSIS_SLACK`이 import만 남아 unused가 됐다.
`yarn lint` **exit 0**이라 놓쳤다 — 내가 기록해둔 함정을 그대로 밟음.
**앞으로 lint는 exit code가 아니라 warning 수를 세서 판정할 것.**
이번 브랜치에서 제거 + JSDoc `{@link}`를 파생 상수로 갱신.

### 감사 1회차: CHANGES REQUIRED (HIGH 1 / MEDIUM 1 / LOW 1) → 전부 반영

**HIGH** — `onPromptAssembled`가 `dedupeInFlight` **밖**에서 발화.
같은 캐시 키 동시 호출 N건이면 실제 생성 1회에 콜백 N회, 그리고 **진 호출자가 캡처한
프롬프트는 전송된 적이 없다**(그가 받는 결과는 이긴 호출자 것). 소비자가
"이 행을 만든 프롬프트"로 저장하면 중복 + 오귀속. 감사가 독립 하네스로 재현함.
→ 양 축 모두 팩토리 **안**으로 이동 + 회귀 테스트(발화 1회, 캡처값 == 실제 전송값).
   기존에 "동시 호출 시 LLM 1회" 테스트가 있었지만 **콜백을 함께 넣은 조합이 없어** 빠져나갔다.

**MEDIUM** — 콜백이 provider 호출 전에 발화 → abort·재시도 소진 실패 시 **고아 레코드**.
재시도 자체는 재발화하지 않음(retry wrapper가 조립된 문자열 재사용). 양 축 JSDoc에 명시:
소비자는 레코드와 결과의 1:1 대응을 가정하면 안 된다.

**LOW** — `toEqual` 전체 비교가 `analyzedAt`(호출마다 벽시계 스탬프) 때문에 플래키.
→ 해당 필드만 제외하고 비교.

게이트 재확인: typecheck 0 / lint **warning 0** / 220파일 **3954 테스트**. 2회차 감사 실행 중.

## promptcap 감사 2회차 → 수정 → 3회차 (2026-09-03)

### 2회차: 1회차 3건 전부 FIXED 확인 + **새 HIGH 1건**
`try { cb() } catch {}`는 **동기 throw만** 잡는다. `async` 콜백의 rejection은
동기 예외로 surface되지 않아 catch가 못 보고, unhandled가 되면 **Node 15+ 기본 정책이 프로세스 종료**.
이 옵션의 문서화된 용도가 "프롬프트 DB 저장"이라 콜백은 거의 항상 async →
평범한 경우이지 엣지가 아니다. TypeScript도 `async` 함수를 `() => void`에 그냥 통과시켜 못 잡는다.
JSDoc은 정확히 반대("소비자 영속화 실패가 분석을 실패시키면 안 된다")를 약속하고 있었다.

**수정**: 공유 헬퍼 `src/application/analysis/notifyPromptAssembled.ts` 신설
(두 축 중복 제거 — 반복 로직 추출은 이 레포 리뷰가 이미 요구한 항목).
동기 throw + 비동기 rejection 양쪽 처리. 콜백 타입을 `=> void | Promise<void>`로 확대.
테스트 5개 — `process.on('unhandledRejection')` 리스너가 **발화하지 않는지** 직접 단언.

**테스트 실효성 직접 검증함**: `.catch()`를 임시 제거하니 정확히 그 테스트 1건만 실패
(`1 failed | 4 passed`), 복원하니 5/5 통과. placebo 아님.

### 문서 stale 발견·정정
`PUBLIC_API.md`가 아직 `=> void` 시그니처, "각 호출부에서 try/catch"라고 적고 있었다.
async 처리·dedup 팩토리 내부 발화·고아 레코드·재시도 미재발화까지 반영해 재작성.

게이트: typecheck 0 / lint **warning 0** / 221파일 **3959 테스트**.

### 3회차 감사: **0 findings — READY TO SHIP**
1·2회차 수정 전부 FIXED 확인. 문서 주장 10개 항목 소스 대조 전부 ACCURATE.
감사가 추가로 확인해준 것: `Promise.resolve`가 비-Promise thenable도 규격대로 체이닝하고
평범한 값엔 no-op이라 오작동 없음 / `settled !== undefined`가 void 동기 콜백과 async 콜백을 정확히 가름 /
반환 타입 확대가 기존 `() => void` 소비자에 호환 / `runAnalysisForOverall`의 technical `Pick`이
`onPromptAssembled`를 전달하지 않아 내부 호출은 캡처 안 됨(문서 주장과 일치).

### PR #188 생성 — https://github.com/y0ngha/siglens-core/pull/188
커밋 `3bbb16f`, 푸시 착지 확인(로컬=원격). CI + claude-review 감시 중.
다음: APPROVED → 머지 → v0.56.0 릴리스 → siglens S2~S4 재개.

## PR #188 첫 라운드 APPROVED (Blocker 0) + Suggestion 2건 반영

### ⚠️ siglens 설계에 직결되는 계약 (Suggestion 1)
`dedupeInFlight`는 승자의 factory만 실행한다. 서로 다른 소비자가 **각자 다른 콜백**으로
같은 심볼·타임프레임을 동시 요청하면 **패자의 콜백은 아예 호출되지 않는다.**
패자는 승자의 결과를 받지만 그 결과에 대응하는 프롬프트는 못 받는다.

대안(모든 호출자 콜백 발화)이 더 나쁘다 — 패자에게 **전송된 적 없는** 프롬프트를 넘겨
결과에 잘못 귀속시킨다. 의도된 트레이드오프로 확정하고 양 축 JSDoc + 테스트로 고정.

**→ siglens는 `prompt_*` 컬럼이 비어 있는 결과 행을 정상으로 취급해야 한다.**
S1에서 nullable로 만든 게 결과적으로 맞았다. S2 write 훅 구현 시 프롬프트 부재를
에러로 처리하지 말 것.

### Suggestion 2
`AssembledPromptRecord.system` JSDoc 문장 다듬기(npm 공개 문서라 반영).

### Question (조치 없음)
`OVERALL_PROMPT_VERSION_PLACEHOLDER` — overall 축에 프롬프트 버전 상수가 없어 리터럴
placeholder 사용. 코드 문제 아니고 향후 계획을 물은 것.

게이트: typecheck 0 / lint warning 0 / 221파일 **3960 테스트**.

## core v0.56.0 릴리스 완료 (2026-09-03)

PR #188 머지 `4ecf82b` (05:15:38Z) → `yarn release:minor --ci` → **v0.56.0**
→ publish 워크플로 success → **tarball 실물 확인** (`dist-tags.latest = 0.56.0`)
릴리스: https://github.com/y0ngha/siglens-core/releases/tag/v0.56.0

siglens 워크트리 bump 0.55.0 → 0.56.0, install 성공, `onPromptAssembled` 노출 확인.

## siglens S2 착수 — SSE 라우트 write 훅

구현 지시 요약:
- `src/entities/analysis/analysisHistoryRepository.ts` 신설 (`usageRepository.ts` 패턴 따름)
- 프롬프트 `stable`/`system`은 sha256 content-address로 `analysis_prompt_blobs`에
  `ON CONFLICT DO NOTHING` upsert 후 해시만 history 행에 기록. `dynamic`은 인라인
- **`prompt` 부재는 정상 경로** — 동시 호출 패자는 콜백이 안 돌지만 결과 행은 남는다.
  주석으로 명시해 나중에 누가 "고치지" 않게 할 것
- 전 구간 best-effort, **절대 throw 금지**
- `node:crypto` 사용 → 클라 번들 유입 차단 필수(과거 배럴 누출로 `crypto-browserify`가
  전 라우트 first-load에 실린 전례). `import 'server-only'` 등 형제 모듈 방식 따를 것
- SSE 라우트 2곳만 배선(technical + overall). 나머지 6축은 범위 밖
- `status === 'done'`만 저장, `'cached'`는 이미 있는 행이므로 제외
- 콜백 안에서 DB write await 금지(provider 호출 직전이라 분석이 지연됨) →
  요청 스코프 변수에 캡처 후 `after()`로 스케줄

**DB 접속 금지** 재차 명시함(.env.local = 운영 Neon).

## siglens S2 완료 (2026-09-03)

- `src/entities/analysis/analysisHistoryRepository.ts` 신설 — `import 'server-only'` +
  `node:crypto` sha256, 배럴 미노출(형제 `usageRepository.ts`와 동일 패턴)로 클라 번들 차단
- 프롬프트 blob은 `onConflictDoNothing({ target: hash })` 배치 insert 후 해시만 기록
- `prompt` 부재 = 정상 경로임을 필드 JSDoc + 인라인 주석 양쪽에 명시
- 전 구간 try/catch, 절대 throw 안 함
- SSE 라우트 2곳 배선(technical / overall). `'cached'`는 저장 제외
- `runOverallAnalysisAction`에 `onPromptAssembled` 옵션 추가·전달

### 구현자가 발견한 함정: `after()`는 동기 throw한다
`next/server`의 `after()`는 요청 스코프 밖에서 호출되면 **콜백이 아니라 `after()` 자체가**
동기 throw한다. overall 호출부는 이 헬퍼를 인라인 호출하므로 그대로 두면 **성공한 분석이
클라이언트 에러가 된다.** `after()` 호출 자체를 try/catch로 감쌌다.

### 내가 추가 수정: `generatedAt`을 결과의 자체 타임스탬프로
저장 스케줄 시각(`new Date()`)을 쓰고 있었다. technical 결과에는 core가 넣은 `analyzedAt`이
있고, **S3가 이력을 봉에 앵커**하므로 저장이 봉 경계를 넘기면 엉뚱한 봉에 귀속된다.
`resolveGeneratedAt()` 추가 — 결과의 ISO 문자열 우선, 파싱 불가면 now
(`Invalid Date`가 컬럼을 오염시켜 모든 정렬·윈도 쿼리를 조용히 깨는 것 방지).

게이트: typecheck 0 / lint warning 0 / 107 테스트.

## siglens S3 착수 — read + priorAnalyses 주입

핵심 지시:
- `findRecentForPrompt`는 `analysisHistoryQuery(timeframe)`로만 사이징(자체 상수 금지)
- **`model_id`/`locale`로 필터 금지** — 감사용 컬럼. 로케일 4개가 한 풀을 공유(다이제스트가
  숫자·enum만이라 언어 중립), 모델도 무관. 필터하면 데이터가 1/4, 1/6로 줄어든다.
  미래의 누군가가 "고칠" 1순위라 JSDoc에 명시
- 저장된 `result`는 몇 달 전 스키마일 수 있음 → 방어적 검증, 못 쓰는 행은 스킵
- **읽기는 core 호출 전 무조건** — core가 이력 지문을 캐시 키에 접으므로 지연 불가.
  인덱스 쿼리 1회 비용 감수(주석 명시)
- 봇 요청(`skipEnqueueIfMiss`)은 생성 안 하므로 쿼리 스킵

## siglens S3 완료 (2026-09-03)

- `findRecentForPrompt(symbol, timeframe, tab, now?)` — `analysisHistoryQuery(timeframe)`로만 사이징
- **`model_id`/`locale` 필터 없음** + JSDoc에 "추가하지 말 것" 경고. 테스트가 `eq` 호출이
  정확히 3회(symbol/timeframe/tab)인지 단언해 필터 추가를 잡는다
- `toPriorAnalysis`: `trend`/`riskLevel` 없거나 비문자열이면 행 스킵,
  가격은 `Number.isFinite`로 **개별** 필터(나쁜 값만 버리고 행은 살림)
- 실패 시 로그 + `[]` 반환, throw 안 함
- 라우트 2축 배선, **core 호출 전 무조건 읽음**(캐시 키에 지문이 접히므로)
- 봇은 `isBot(request.headers)` 결과를 `POST`에서 한 번 계산해 재사용 → 이력 쿼리 스킵.
  구현자가 `next/headers` 경유를 시도했다가 목 의존성이 늘어 `Request` 기반으로 선회함
- `DISPATCH` 핸들러 시그니처에 4번째 인자 `isBotRequest` 추가(overall만 사용)

게이트: typecheck 0 / lint 0 warning / **116 테스트**

## siglens S4 착수 — 리텐션

- `pruneAnalysisHistory(now?)` → `{ rowsDeleted, promptsCleared }`
- result 90일 삭제 / `prompt_dynamic` 7일 후 NULL(해시·버전은 유지 — 작고 세대 식별에 유용)
- 참조 없는 blob 정리는 **행 삭제·프롬프트 클리어 이후에** 수행(최종 상태를 봐야 함).
  S1이 FK를 안 건 이유가 이 서로 다른 주기다
- **삭제 작업 경계 필수** — 몇 달 자란 테이블에 무제한 DELETE는 락·시간예산 초과.
  배치/최대나이 캡 + 초과분은 다음 실행이 처리한다는 주석
- 기존 `seo-prewarm` 크론에 추가(신규 엔드포인트 금지), prewarm 본작업 뒤·실패 격리

## siglens S4 완료 + 전체 게이트 (2026-09-03)

- `pruneAnalysisHistory(now?)` — result 90일 삭제 / `prompt_dynamic` 7일 후 NULL(해시·버전 유지) /
  참조 없는 blob 정리(마지막에)
- 상수 3개 `RESULT_RETENTION_DAYS` `PROMPT_DYNAMIC_RETENTION_DAYS` `PRUNE_BATCH_SIZE`(500)
- `seo-prewarm` 크론의 기존 `after()` 안, prewarm 본작업 뒤 · 락 해제 전에 자체 try/catch로 격리

### 구현자가 피한 함정 2가지 (기록해둘 가치 있음)
1. **Postgres엔 `DELETE ... LIMIT`이 없다**(MySQL 확장). Drizzle의 `PgDeleteBase`에도 `.limit()` 없음.
   → `WHERE id IN (SELECT id FROM … LIMIT 500)` 관용구로 경계. 초과분은 다음 크론 틱이 처리
   (셋 다 순수 만료 sweep이라 틱 간 순서 의존 없음)
2. **고아 blob 판정에 `notInArray` 쓰면 안 된다.** 해시 컬럼이 nullable이라
   `NOT IN (NULL 포함 서브쿼리)`는 3값 논리로 **모든 고아를 조용히 살려둔다.** → `notExists` 사용

### siglens 전체 게이트
typecheck 0 / lint **warning 0** / **1194 파일 11968 테스트 통과**(1 skipped)

## siglens 배포 안정성 감사 실행 중
중점: 요청 경로 비용(매 요청 이력 쿼리 1회, 인덱스 커버 여부) / 캐시 키 정합(봇 경로가
캐시를 파편화하지 않는지) / 실패 격리 4종 / **symbol·timeframe·tab이 쓸 때와 읽을 때
같은 정규형인지**(대소문자·fmpSymbol 불일치면 읽기가 항상 0을 반환하면서 건강해 보인다) /
리텐션 경계 / `node:crypto` 클라 번들 유입 / **마이그레이션 미적용 상태로 배포돼도 동작하는지**

## siglens 감사 1회차: CRITICAL 0 / HIGH 0 / MEDIUM 1 / LOW 3

### MEDIUM — 고아 blob sweep이 동시 쓰기가 참조하려는 blob을 지운다
`saveAnalysisHistory`는 blob insert → history insert 두 번을 **트랜잭션 없이 순차**로 한다.
그 사이 네트워크 왕복이 있고, 그 틈에 크론 sweep이 돌면 "참조 0"으로 보고 지운다.
직후 history 행이 없는 해시를 가리키게 됨. FK가 없어(의도) 조용히 실패.
영향은 디버그용 프롬프트 텍스트에 한정(기능은 `result`만 읽음).
→ `firstSeenAt` 최소 나이 가드 추가. `notExists` 유지(nullable 컬럼에 `NOT IN`은 3값 논리 함정).

### LOW 1 — 이력 읽기가 동시성 상한 검사보다 먼저
비봇 요청마다 인덱스 쿼리(+Neon 일시 오류 시 최대 ~1.4초 백오프)를 치른 뒤에야 503으로 거절된다.
부하 급증 시점에 DB 부하가 더 얹힌다. 기존에도 티어 게이트 등이 상한 앞에 있어 신규 회귀는 아님.
→ 상한 검사 뒤로 이동 시도. **단 상한 검사와 스트림 생성 사이 원자성 주석이 있어,
   깨진다면 이동하지 말고 사유를 남기라고 지시함.**

### LOW 2 — write 경로 자동 검증 0
`route.test.ts`가 `next/server`를 목하지 않아 `after()`가 동기 throw하고(설계상 catch됨)
**콜백 본문이 테스트에서 한 번도 실행되지 않는다.** `tab` 리터럴이나 `modelId` 폴백이
틀려도 `yarn test`가 못 잡는다. → 크론 테스트 방식대로 `after` 목·캡처·호출해 인자 단언.

### LOW 3 — 배럴 아닌 엔티티 파일 deep import
의도된 것(`node:crypto`를 배럴에서 빼 과거 `crypto-browserify` 전 라우트 누출 재발 방지,
`usageRepository.ts`가 선례)인데 문서화가 안 돼 우연처럼 보임. → 파일 상단 JSDoc으로 명문화.

### 감사가 확인해준 안전 항목 (재검증 불필요)
- **캐시 키**: `undefined`(봇)와 `[]`(빈 테이블/비봇)가 **동일 키** 생성 →
  배포일 키가 기존과 바이트 동일, 봇 경로가 캐시를 파편화하지 않음. 로케일·모델 간 지문도 동일
- SSE 응답 미차단(technical은 독립 `.then()` 구독, overall은 결과 확정 후 동기 호출),
  `onPromptAssembled` 콜백은 변수 대입뿐이라 provider 호출 지연 0
- 실패 격리 4종 전부 확인(`after()` 동기 throw 포함)
- **`symbol`/`timeframe`/`tab`은 한 요청 안의 같은 변수에서 쓰고 읽음** → 정규형 불일치 없음
- **마이그레이션 미적용 배포 안전**: `42P01`은 transient 목록에 없어 즉시 re-throw되고
  각 메서드 try/catch가 degrade. 이력만 없고 분석은 정상 동작
- 인덱스가 쿼리 shape와 정확히 일치(equality prefix + trailing sort) → Index Scan

## siglens 감사 1회차 수정 완료 + 2회차 (2026-09-03)

4건 전부 반영. 전체 게이트: typecheck 0 / lint warning 0 / **1194 파일 11977 테스트**(+9, 회귀 0).

- **A**: `ORPHAN_BLOB_MIN_AGE_MS = 5분` 가드를 sweep 컷오프에 적용(`repository.ts:112, 389`).
  `notExists` 유지
- **B**: 이력 읽기를 동시성 상한 **뒤**로 이동. `withDeadline` 클로저 안으로 넣는 방식
- **C**: `next/server`의 `after`만 좁게 목 → 콜백 캡처·호출해 인자 단언. 테스트 7개 추가
- **D**: 배럴 미노출이 의도임을 파일 상단 JSDoc으로 명문화

### B 원자성 직접 검증(내가 인라인으로 확인)
`withDeadline`(route.ts:207)은 `const started = (async () => run(controller.signal))();`
— 즉시 실행 async IIFE로 `run`을 부르고 `Promise.race(...).finally(...)`를 **동기 반환**한다.
호출부에서 `canAcceptAnalysisStream(...)`와 `new Response(heartbeatStream(...))` 사이에
최상위 `await`가 없다. 내부 `await`는 그 클로저만 중단시킨다. **원자성 유지 확인.**
(깨졌다면 부하 시 동시성 상한이 초과 구독됐을 것)

### A/D도 인라인 확인
상수 적용 위치, `notExists` 4곳 유지, `analysisHistoryRepository`·`usageRepository` 모두
배럴에 0회 등장(선례 주장 정확).

### 2회차 감사가 세션 한도로 리포트 직전 사망 → 확인 패스 재실행
마지막 출력은 "네 수정 + 회귀 항목 전부 확인, 리포트 작성 중"이었으나
부분 출력을 결론으로 삼지 않고 재확인 중. 이미 검증한 A/B/D는 증거와 함께 전달해
C(테스트 목 범위·단언 실효성·격리)와 회귀 스윕에만 집중시킴.

## siglens 감사 2회차: 0 findings — READY TO SHIP (2026-09-03)

C(테스트) 검증 결과:
- 목 범위 PASS — 라우트가 `next/server`에서 `{ after }` 하나만 import하고 테스트는
  `new Request(...)`를 쓴다(`NextRequest` 미사용). 기존 106개 무영향, 파일 전체 113/113 통과
- 단언 실효성 PASS — 7개 테스트 전부 리터럴 값 단언(`tab: 'technical'/'overall'`,
  `modelId: 'gemini-2.5-flash'`와 폴백 `'analysis-worker'`, `locale: 'ja'/'ko'`).
  블록 안에 `expect.any(...)` 0회
- 목 격리 PASS — 전역 `beforeEach`의 `vi.clearAllMocks()`, `mockAfter`는 구현이 없어
  캡처한 콜백을 자동 실행하지 않음

회귀 스윕 8항목 전부 PASS. 특히:
- 캐시 키: core가 `options.priorAnalyses ?? []`로 정규화 →
  `fingerprint: undefined` → `historyKeySuffix('')`. 봇·빈 테이블 모두 **기존 키와 동일**
- 마이그레이션 미적용 배포: `42P01`이 `TRANSIENT_SQLSTATE_CODES`에 없어 즉시 re-throw,
  각 메서드 try/catch가 degrade → 분석 정상 동작
- 리텐션 3개 문장 전부 `.limit(500)`, cutoff 기반이라 잔여분은 다음 틱이 자연히 재선택

## siglens PR #784 생성 — https://github.com/y0ngha/siglens/pull/784
커밋 `7854bf0`, 푸시 착지 확인(로컬=원격). CI + 리뷰 감시 중.

## (구 메모) PR 생성 중
게이트: typecheck 0 / lint warning 0 / **1194 파일 11977 테스트**
⚠️ pre-push 훅이 build를 돌려 시간이 걸린다. `--no-verify` 금지 명시함.

## trader 착수 (2026-09-03)

### core 6버전 점프 결과: 회귀 0
0.50.2 → 0.56.0. 로케일·통화 계약 변경이 딸려오지만 typecheck 0,
**80파일 2227 테스트 전부 통과**(4 skipped, 기존과 동일). 코드 수정 없이 통과.

### 구현 범위: technical 단독
trader 분석축은 technical/news/options/fundamental/congress 5개이고 **overall이 없다.**
그중 봉이 있는 건 technical뿐이라 나머지 4축은 범위 밖.

### 지시 요약
1. `analysis_results`에 `timeframe` 컬럼 추가 + `'1Hour'` 백필 + 인덱스 확장.
   타임프레임은 `config` 테이블의 **전역 값**이라 운영자가 바꾸면 이전/이후 행이 구분 불가 →
   1Hour 분석을 15Min 봉에 대고 재게 된다.
   `saveAnalysisResult`는 `timeframe`을 **명시 인자로** 받는다(`app_version`처럼 내부 파생 금지 —
   호출부가 실제로 아는 값이고, 기본값을 주면 한 축이 빠뜨려도 컴파일이 통과한다)
2. `getRecentAnalysisResults` 추가
3. `run-technical.ts`에서 `analysisHistoryQuery(timeframe)`로 사이징해 `priorAnalyses` 주입.
   **`model_id` 필터 금지**, 방어적 매핑, 실패 시 이력 없이 진행
4. **금지**: 다른 4축 배선 / `lib/strategy/**` 변경 / 매매 동작 변경 /
   `getLatestAnalysisResult` 동작 변경(execute 크론의 신선도 게이트 —
   타임프레임 필터를 걸면 운영자가 값을 바꾼 직후 전 종목이 "분석 없음"이 되어 청산 평가가 멈춘다)

trader는 `force = true`로 core Redis 캐시를 우회하므로 웹앱의 캐시 키 이슈는 무관.
**DB 접속 금지** 명시함.

## siglens PR #784 리뷰 지적 반영 (2026-09-03)

체크 9종 전부 pass인데 `reviewDecision=CHANGES_REQUESTED`. Blocker 3 + Suggestion 1.

- **Blocker(실질)**: `trend as Trend` / `riskLevel as RiskLevel`가 `typeof === 'string'`만
  보고 캐스팅. `'sideways'` 같은 **유니온 밖 문자열이 검증 없이 AI 프롬프트에 사실처럼 주입**된다.
  이 함수 JSDoc이 "오래된 스키마 행일 수 있다"고 스스로 인정하는데 그 위험을 안 막고 있었다.
  → `ReadonlySet` 기반 실제 멤버십 가드 + 유니온 밖 문자열 테스트 추가
- **Blocker**: `reduce` + `.push()` 누산기 변경 → `map` + 타입 좁히는 `filter`
- **Blocker**: `pruneAnalysisHistory` 인라인 객체 반환 타입 → `PruneAnalysisHistoryResult` 인터페이스
- **Suggestion**: `after()` 자체가 동기 throw하는 방어 분기 미검증 → 테스트 추가
  (분석 응답 정상 + 영속화 스킵 + 로그 남김 단언)

게이트: typecheck 0 / lint warning 0 / **1194 파일 11979 테스트**

## trader 구현 완료 (2026-09-03)

- `timeframe` 컬럼 + `'1Hour'` 기본값 백필. **새 인덱스** `idx_analysis_symbol_type_timeframe_date`
  추가 — 기존 인덱스를 확장하면 `getAllLatestAnalysisResults`의
  `DISTINCT ON (symbol, analysisType) ORDER BY … analyzedAt` 매칭이 깨진다(구현자 판단, 타당)
- 마이그레이션 `drizzle/0018_flawless_puck.sql` — 생성만, 미적용
- `saveAnalysisResult(timeframe)` 필수 인자화. 유일 호출부 `api/cron/_run-analysis-cron.ts`(5축 공용)
- `PriorAnalysisStore` 포트 신설(`NewsCardStore` 패턴) → `lib/analysis/`가 DB-free 유지.
  크론이 **technical일 때만** 주입
- `lib/analysis/prior-analysis.ts` 매핑 + `safe-extract.ts`에 헬퍼 2개 추가

게이트: typecheck 0 / lint 0 warning / **81파일 2251 테스트**(+24, 회귀 0)

### 미처리 (사소)
`lib/db/CLAUDE.md`의 테이블/함수 레퍼런스 표 미갱신 — 하우스 스타일이면 반영 필요

## 동시 진행 중
- siglens: 리뷰 반영분 커밋·푸시 → 재리뷰 예정
- trader: 배포 안정성 감사 1회차

## trader 감사 1회차: CRITICAL 1 / HIGH 1 / LOW 1 → 반영 (2026-09-03)

### CRITICAL — 마이그레이션보다 코드가 먼저 나가면 `analysis_results` 전 쿼리가 깨진다
**Drizzle은 `SELECT *`를 쓰지 않는다.** `.select()`가 스키마 객체에서 컬럼 목록을 만들어
명시 나열한다. 그래서 `schema.ts`에 `timeframe`이 추가된 이미지가 컬럼 없는 DB를 만나면
신규 쿼리뿐 아니라 **기존 `getLatestAnalysisResult`·`getAllLatestAnalysisResults`·
`saveAnalysisResult`까지 전부** `column "timeframe" does not exist`로 실패한다.

각 크론의 per-symbol/per-position try/catch가 잡아 잘못된 주문은 안 나가지만,
**보유 포지션의 손절·목표가 평가가 그 시간 동안 통째로 멈춘다.** 리스크 감시가 눈을 감는다.
`infra/aws/deploy.sh`에 마이그레이션 단계가 없다.

→ 코드 결함이 아니라 **배포 순서 제약**. `docs/DEPLOYMENT.md` §12에 전용 절 추가:
   메커니즘(Drizzle 명시 컬럼 목록), 실제 파급, 정확한 명령, deploy.sh에 단계 없음을 명시.
   (컬럼 자체는 `DEFAULT '1Hour' NOT NULL`이라 기존 행 자동 백필 + 메타데이터 변경이라 락 폭주 없음)

### HIGH — siglens와 **동일한 결함**: 유니온 멤버십 미검증
`safeAnalysisTrend`/`safeAnalysisRiskLevel`이 `typeof === 'string'`만 보는데 그대로 캐스팅.
런타임에 터지지도 않는다 — core 렌더러가 그 값을 보간해 **"과거에 이렇게 판단했다"는
사실 진술로** 프롬프트에 싣는다. 모델이 자기 과거 판단을 사실 대조하게 만드는 기능인데
그 사실 자체가 거짓이 된다. → `isTrend`/`isRiskLevel` 가드 + 유니온 밖 문자열 테스트.

**두 레포에서 같은 실수가 독립적으로 반복됐다** — 방어적 매핑을 지시할 때
"문자열인지"가 아니라 "**유니온에 속하는지**"를 명시해야 한다.

### LOW — 캐시 키 지문이 매번 바뀌어 안 읽힐 Redis 키가 쌓인다
core의 캐시 **쓰기**는 `!force` 게이트가 없다(읽기만 있다). 지문이 이력과 함께 바뀌므로
force 실행마다 새 키를 쓰는데 trader는 `force=true`라 절대 안 읽는다. TTL(≤1시간)로 자기 한정.
→ 정보성으로 수용, 2회차에서 정량 판단 요청.

게이트: typecheck 0 / lint warning 0 / **81파일 2252 테스트**

## siglens PR #784 재리뷰
본문 없는 COMMENTED(잡음) 1건 들어옴, `claude-review` 아직 pending. 재감시 중.

## siglens 리뷰 2라운드 반영 (`beec80d`, 2026-09-03)

리뷰어가 1라운드 지적 3건이 `c960438`에서 해소됐음을 코드로 직접 확인. 남은 Blocker 1건:

**`resolveGeneratedAt`의 두 분기가 무검증** — 내가 인라인으로 추가한 함수인데 테스트를 안 붙였다.
기존 write 테스트가 전부 `analyzedAt` 없는 결과를 써서 폴백만 탔고, `generatedAt` 값 자체를
단언하는 테스트가 없었다.
→ 두 분기 테스트 추가: (a) `analyzedAt`이 있으면 그 시각을 저장(봉 경계 넘김 시 엉뚱한 봉
귀속 방지), (b) 파싱 불가면 `Invalid Date` 대신 현재 시각(이 열을 읽는 정렬·윈도 쿼리가
에러 없이 깨지는 것 방지).

게이트: typecheck 0 / lint warning 0 / **1194 파일 11981 테스트**. Draft 토글로 3라운드 재리뷰 중.

## trader 감사 2회차: B·C 종결, MEDIUM 1 + LOW 1 → 둘 다 반영 중

**MEDIUM** — 0018 경고를 `DEPLOYMENT.md` §12(수동적 부록, inbound 참조 0)에 넣었다.
이 문서의 정식 배포 전 경로는 §64 "배포 전 필수"이고 "안전 롤아웃 순서"가 2단계로 번호를 매기며
§9도 거기로 되돌린다. 운영자가 습관적 경로로 가면 §12에 **도달하지 않는다.** → §64로 이동/교차참조.

**LOW → 구현하기로** — `deploy.sh`가 **이미** `/api/health`를 폴링해 배포 성공/실패를 가르는데
`health.ts`가 DB를 안 건드려 이 사고를 못 잡는다. 새 인프라 없이 기존 게이트에 배선만 하면 된다.
게다가 이 레포는 같은 심각도에 **이미 fail-closed를 택한다** — `server/app.ts`의 `CRON_SECRET`
부팅 거부, §11의 Redis 락 fail-closed. 이번 건만 조용한 degrade로 두는 건 자기 철학과 반대.

설계 제약: 스키마 불일치(`42703`/`42P01`)는 unhealthy, **일시 장애는 healthy**로 구분
(안 그러면 Neon 순간 장애가 멀쩡한 배포를 죽인다). 기존 transient 분류 헬퍼 재사용
(목록 두 벌이 갈라지면 그 자체가 결함). 짧은 타임아웃 필수 —
**멈추는 헬스체크는 실패하는 헬스체크보다 나쁘다.**

C(캐시 키 지문) 정량 판정: 1Hour TTL과 쓰기 주기가 같아 orphan 키가 다음 것 쓸 때 만료 →
상주 footprint는 심볼당 ~1키, 누적 아님. 조치 불필요.

## siglens 리뷰 3라운드 Blocker — prewarm 경로 배선 누락 (2026-09-03)

**실제 누락이고 지적이 정확하다.** SSE 경로(`app/api/analysis/stream/route.ts`)만 배선했는데,
같은 core 함수를 부르는 **형제 진입점**이 하나 더 있다:
`entities/analysis/api.ts`의 `prewarmTechnical()`(~62) / `prewarmOverall()`(~155)
→ `app/api/cron/seo-prewarm/harvest.ts`(~61-62)가 호출.

둘 다 `onPromptAssembled`/`priorAnalyses`를 안 넘긴다. 결과:
1. prewarm이 만든 `done` 분석은 `analysis_history`에 **절대** 안 쌓인다
2. 그 캐시를 유저가 히트해도 `'cached'`라 저장 대상이 아니다

즉 **prewarm으로 캐시가 채워지는 롱테일 종목 — seo-prewarm 크론이 존재하는 이유 그 자체 —
에서 기능이 영구히 죽는다.** `findRecentForPrompt`가 계속 `[]`만 반환.

같은 크론 파일에 **정리(`pruneAnalysisHistory`)는 이미 연결해뒀으면서 생성만 빠졌다** →
MISTAKES.md §6.7(동일 upstream을 감싸는 형제 진입점 중 하나에만 규칙 적용) 패턴.

### 수정 지시 요점
- 쓰기: `done`일 때 SSE와 동일 값으로 저장, 프롬프트는 `onPromptAssembled`로 캡처
- 읽기: `priorAnalyses`도 넘겨야 한다 — core가 지문을 캐시 키에 접으므로, 이력 없이 prewarm하면
  이력을 주는 유저 요청과 **다른 키**를 계산해 캐시를 공유 못 하게 된다(prewarm 목적과 정반대).
  단 이 주장을 실제 코드로 검증 후 구현하라고 지시
- `generatedAt`은 `resolveGeneratedAt` 로직 공유(중복 정의 금지)
- `prewarmTechnical` JSDoc이 **request-context 호출 금지**를 명시(크론 `after()` 안,
  React 요청 스코프 없음) → `after()` 사용 가능 여부를 확인 후 결정, 불가면 repository 직접 호출
- `analysisHistoryRepository`는 배럴 미노출(의도) — 상단 JSDoc 읽고 import 방식 결정

## trader 3회차 감사 진행 중
2회차 수정(문서 §64 이동 + `?ready=true` 스키마 프로브) 검증 대상.
`deploy.sh` 27행이 실제로 `?ready=true`를 폴링함을 확인. 게이트 82파일 2262 테스트.

## trader 감사 3회차: 0 findings — READY TO SHIP (2026-09-03)

### 배포 게이트 의미론 검증
- **실패 경로 PASS**: `curl -f`가 503을 exit 22로 처리 → `healthy`/`exit 0` 분기 도달 불가 →
  루프 소진 → `exit 1` → SSM `Status=Failed` → 로컬 루프가 잡아 `deploy Failed` 출력.
  `-S` 덕에 매 시도의 `curl: (22)`도 stderr에 남아 조용히 지나가지 않는다
- **정상 배포 오탐 위험 PASS**: 프로브가 **fail-open**이다. `42703`/`42P01`에만 503,
  자체 2초 타임아웃 포함 그 외 전부 200. Neon 콜드 커넥션으로는 배포를 못 죽인다.
  기존 60초(30×2s) 예산·연결 요건도 이 PR로 안 바뀜

### 남용 표면 PASS
`provision.sh`가 보안그룹에 **인바운드 규칙 0개**로 프로비저닝(유일 경로는 아웃바운드
Cloudflare Tunnel). `getDb()`가 `Pool({max:10})`를 프로세스당 캐시해 반복 호출이
커넥션을 새로 안 연다. 유출 검증: `String(err)`가 클라에 닿는 경우는 (1) 스키마 불일치
(`Failed query: select "timeframe" from "analysis_results" limit 1` — 주석이 주장한
"컬럼 하나 존재 여부" 그 이상 아님), (2) `getDb()` 동기 throw(누락 env 변수명만).
그 외 DB 에러는 `checkSchemaReadiness` 안에서 `ready:true`로 정규화돼 호스트명·연결
정보가 새어나갈 수 없다

### 문서 PASS
§64 경고 박스 + "안전 롤아웃 순서" 2단계 교차참조. 문서 전체 grep으로
"deploy.sh가 못 잡는다"는 낡은 문장 잔존 0 확인. §13의 bare `/api/health` 참조는
DNS 컷오버 전 liveness 체크라 무관(낡은 게 아님). 트러블슈팅 표에 `unhealthy` 행 추가

### 회귀 스윕 9항목 전부 PASS
특히 `saveAnalysisResult` 쓰기와 `priorAnalysisStore.getRecent` 읽기가 **동일 `timeframe`
const**(한 번 정의)를 쓴다는 것까지 추적 확인 — 쉐도잉 없음

## trader PR 생성 중

# ===== 현재 상태 요약 (2026-09-03, 세션 재개 시 여기부터) =====

## 완료
- **core v0.55.0** (prior-analysis context) — 감사 4회차 0건, 리뷰 6라운드 APPROVED, 머지·publish·tarball 확인
- **core v0.56.0** (프롬프트 캡처 훅) — 감사 3회차 0건, 리뷰 1라운드 APPROVED, 머지·publish·tarball 확인
- **siglens 구현** S1~S4 + prewarm 배선. 감사 2회차 0건. 게이트 1194파일 **11991 테스트**
- **trader 구현** technical 단독. 감사 3회차 0건. 게이트 82파일 **2262 테스트**

## 열린 PR (둘 다 감사 0건, 남은 건 코드 리뷰 승인뿐)
- **siglens #784** https://github.com/y0ngha/siglens/pull/784 — HEAD `74d7f3e`
  리뷰 3라운드까지 반영(마지막: prewarm 경로 배선 누락 Blocker). 4라운드 재리뷰 중
- **trader #57** https://github.com/y0ngha/siglens-trader/pull/57 — HEAD `b08012f`

### ⚠️ 두 레포 모두 `claude-review`가 계정 한도로 **실행 자체 실패** (코드 문제 아님)
실패 서명이 양쪽 동일: `is_error:true / num_turns:1 / total_cost_usd:0 / modelUsage:{}`
→ 모델이 아무 출력도 못 냈다. API 레벨 거부다.
- trader: 2회 시도(초회 + Draft 토글 1회) 모두 동일 실패
- siglens: 4라운드 재리뷰에서 동일 실패. 남아 있는 `CHANGES_REQUESTED`는 **3라운드의 낡은 판정**
- 양쪽 다 지연 재트리거 예약해둠(trader 40분, siglens 45분)
- 판정은 체크가 아니라 `gh pr view --json reviewDecision` + 새 리뷰 본문 길이(>200)로 확인할 것

## 다음에 할 일
1. siglens #784 4라운드 리뷰 결과 → 지적 있으면 반영 → APPROVED → **머지**
2. trader #57 리뷰 재실행 성공 확인 → 지적 반영 → APPROVED → **머지**
3. trader 머지 후 배포 시 **반드시 마이그레이션 먼저**(`yarn db:migrate`) — 안 그러면
   `analysis_results` 전 쿼리가 깨져 포지션 청산 평가가 멈춘다. `?ready=true` 프로브가
   deploy.sh에서 이걸 잡도록 배선돼 있음

## 마이그레이션 미적용 상태 (의도)
- siglens `drizzle/0033_analysis_history.sql`
- trader `drizzle/0018_flawless_puck.sql`
둘 다 생성만 하고 적용 안 함. **운영 DB 접속 금지**를 모든 서브에이전트에 명시했음.

# ===== 종료 (2026-09-03) =====

사용자 판단으로 **claude-review 대기를 중지**. 재시도 모니터 전부 정리함.

## 리뷰 봇 상태 (재개 시 여기부터)
`claude-review` 워크플로가 계정 한도로 **실행 자체가 불가**. 실패 서명 양쪽 동일:
`is_error:true / num_turns:1 / total_cost_usd:0 / modelUsage:{}`
- trader #57: 4회 시도 전부 실패, 제출된 리뷰 0건
- siglens #784: 4라운드 재리뷰 실패. 남은 `CHANGES_REQUESTED`는 **3라운드의 낡은 판정**이고
  그 지적(prewarm 배선 누락)은 `74d7f3e`로 이미 반영됨

## 재개 절차
1. `gh pr ready --undo <PR> && gh pr ready <PR>` (push는 트리거 아님)
2. 판정은 체크가 아니라 `gh pr view --json reviewDecision` + 새 리뷰 본문 길이(>200)로 확인
3. APPROVED 후에만 머지. 낡은 CHANGES_REQUESTED를 dismiss하고 밀어붙이지 말 것

## 머지 후 배포 시 필수
- **trader: `yarn db:migrate` 먼저.** 안 하면 Drizzle 명시 컬럼 목록 때문에
  `analysis_results` 전 쿼리가 깨지고 **포지션 청산 평가가 조용히 멈춘다.**
  `/api/health?ready=true` 프로브가 deploy.sh에서 이걸 잡도록 배선돼 있음
- siglens: `drizzle/0033_analysis_history.sql` 적용 전까지 이력만 안 쌓이고 분석은 정상 동작

## prewarm 델타 감사 (2026-09-03) — 0 findings, READY TO SHIP

**왜 필요했나**: siglens 감사 2회차 0건은 `beec80d` 시점이었고, prewarm 배선은
claude-review 3라운드 지적으로 그 뒤 `74d7f3e`에 들어와 **감사를 안 거친 상태**였다.
"감사 0건 이후 PR" 조건을 그 델타가 만족 못 해서 델타 한정으로 돌림.

확인된 것:
- `resolveGeneratedAt` 이동은 본문 **바이트 동일**(JSDoc만 추가). 두 테스트 파일 모두
  `vi.importActual` 스프레드라 진짜 구현을 계속 탄다(스텁 아님)
- `'cached'`/`'miss_no_trigger'`는 저장 안 함. 쓰기·읽기 모두 이중 best-effort
  (`persistPrewarmAnalysis` try/catch + `saveAnalysisHistory` 자체 try/catch)
- `getDatabaseClient()` 동기 throw까지도 `runPrewarmBatch`의 기존 per-unit catch가 잡아
  30분 백오프 마커 찍고 `continue` — 배치 전체를 못 죽인다
- **캐시 키 정합 달성 확인**: `findRecentForPrompt`가 `(symbol, timeframe, tab)`만 필터하고
  `model_id`/`locale`을 안 걸므로 prewarm과 익명-free 유저가 **동일 행 집합 → 동일 지문**.
  나머지 축(modelId/reasoning/positionBucket/locale/tier)은 이 델타 이전부터 이미 일치
- `modelId`/`locale` 하드코딩은 추측이 아니라 같은 함수가 실제로 넘기는 값과 동일.
  `timeframe`은 `const timeframe = '1Day'` 하나로 읽기·분석·쓰기가 공유
  (기존엔 `'1Day'` 리터럴이 3개였으니 오히려 위험 감소)
- 중첩 `after()` 없음 — 크론의 기존 `after()` 안에서 직접 await하므로 SIGTERM 드레인이
  새 DB 왕복까지 기다린다
- 부하: 틱당(5분) 추가 SELECT 최대 12, INSERT 최대 12(생성 시에만). ≈144 reads/hour

**세 레포 전 코드가 감사 0건 통과 완료.**

# ===== siglens 머지 완료 (2026-09-04 00:23:49Z) =====

PR #784 APPROVED → suggestion 1건(인라인 유니온 → `AnalysisHistoryTab` 재사용) 반영
→ `4aa9b1a` → 전 체크 pass / CLEAN → **일반 merge 완료**

## trader `claude-review`는 레포 상시 고장 (중요)
`gh run list --workflow=claude-code-review.yml`로 확인: **2026-08-22까지 전 run 실패.**
`fix/chunk-load-failure`, `feat/risk-reward-gate`, `fix/static-body-and-cache` 등
이 작업과 무관한 브랜치도 전부. 2주 전 실패 서명이 지금과 동일
(`is_error:true / num_turns:1 / cost 0`, init 후 3분 침묵).
같은 시간대에 siglens 리뷰는 정상 작동해 승인까지 났으므로 **계정 한도가 아니다.**
→ 그 레포는 2주째 자동 코드 리뷰 없이 머지되고 있었다. 별도 수정 대상.

→ 로컬 코드 리뷰로 대체 실행. Blocking 1 + Non-blocking 1, 둘 다 반영(`cc9ddeb`):

**Blocking — 실패할 수 없는 테스트**
`getRecentAnalysisResults` 테스트가 `where`/`orderBy` **호출 여부만** 단언.
모킹 체인이 어떤 쿼리든 같은 스텁을 주므로 `timeframe` 술어 제거, `gte`↔`lte` 교체,
`desc`→`asc` 반전이 전부 초록이었다. 드리즐 조각을 동일 조립해 깊은 비교로 교체.
**구현에서 `timeframe` 술어를 임시 제거해 정확히 그 테스트만 실패하는 것 확인 후 복원.**
(`renderSqlText`는 `sql` 템플릿용이라 `and(eq(...))` 조합엔 빈 문자열을 낸다 — 못 씀)

**Non-blocking이지만 실은 정확성 문제 — `safeAnalysisTakeProfitLadder`**
JSDoc은 "오름차순"인데 정렬 안 함. core가 `takeProfitPrices[0]`을 **최근접 목표가**로
보고 채점하므로, 내림차순 저장된 옛 행이 있으면 가장 먼 목표를 최근접으로 읽어
**"미달"을 "달성"으로 뒤집어** 보고한다. 정렬 강제 + 역순 입력 테스트 추가.

게이트: typecheck 0 / lint warning 0 / 82파일 **2267 테스트**

# ===== 전체 완료 (2026-09-04) =====

| 레포 | 결과 |
|---|---|
| core | v0.55.0 + v0.56.0 머지·릴리스·publish·tarball 확인 |
| siglens | PR #784 **머지 완료** (00:23:49Z) |
| trader | PR #57 **머지 완료** (00:28:02Z) |

## trader 머지 직전 델타 확인 (0 findings, SAFE TO MERGE)
`cc9ddeb`가 매매 경로 파일(`lib/strategy/safe-extract.ts`)의 동작을 바꿔서 별도 확인함:
- `safeAnalysisTakeProfitLadder`의 유일한 호출자는 `lib/analysis/prior-analysis.ts:65`.
  `trade-gate.ts`·`execute.ts`에서 **도달 불가** 확인(추적으로 검증)
- 매매 경로가 쓰는 `safeAnalysisTakeProfit`(단수, `execute.ts:1180`)과
  `trade-gate.ts:513/522`의 `actionLevels()`는 **미변경**
- `[...ladder].sort()`로 복사 후 정렬 — 호출자 배열 미변형
- **정렬의 근거를 설치된 core로 검증**: `priorAnalysisSection.js:154`가
  `takeProfitPrices?.find(Number.isFinite)`로 첫 유한값을 "최근접"으로 읽는다.
  내림차순 저장 행이 있으면 가장 먼 목표를 최근접으로 읽어 **미달을 달성으로 뒤집는다.** 전제 확인됨
- 강화한 단언의 실효성도 3종 변이 전부에 대해 검증
  (`timeframe` 제거 / `gte`→`lte` / `desc`→`asc` 모두 깊은 비교 불일치)

## ⚠️ 배포 시 반드시
- **trader: `yarn db:migrate` 먼저.** Drizzle 명시 컬럼 목록 때문에 마이그레이션 없이
  이미지가 나가면 `analysis_results` 전 쿼리가 깨지고 **포지션 청산 평가가 조용히 멈춘다.**
  `/api/health?ready=true` 프로브가 `deploy.sh`에서 이걸 잡는다(fail-open이라 정상 배포는 안 죽임)
- siglens: `drizzle/0033_analysis_history.sql` 적용 전까진 이력만 안 쌓이고 분석은 정상

## 별건 발견 (이 작업과 무관, 손볼 대상)
siglens-trader의 `claude-review` 워크플로가 **2026-08-22부터 전 run 실패**.
무관한 브랜치들도 전부. 즉 그 레포는 2주째 자동 코드 리뷰 없이 머지되는 중.

# ===== 스크래치 DB 실증 + 후속 수정 2건 (2026-09-05) =====

배포 가능 여부를 판단하려고 **Docker 스크래치 Postgres**로 실증. 운영 DB 미접촉.
목킹 테스트가 구조적으로 못 잡는 결함 **2건**이 나왔다.

## siglens 실증 — 전부 통과
- 마이그레이션 0033이 기존 32개 위에 적용, 인덱스·enum 정확
- **`pruneAnalysisHistory` 실동작 확인**: 90일 삭제 / 7~90일은 행 유지+`prompt_dynamic`만 null /
  5분 가드보다 새 blob 보존. **배치 캡을 501행으로 검증 — 1차 500, 2차 1.**
  한 번도 실행된 적 없던 `id IN (SELECT … LIMIT n)`가 설계대로 동작
- `EXPLAIN`이 `analysis_history_lookup_idx`를 탐(3천행 시드+ANALYZE, Seq Scan 없음)
- blob `onConflictDoNothing` 확인, model/locale 미필터 확인

## 결함 1 — 가격 `0`이 통과해 거짓 "target reached" (siglens PR #786, **머지 완료**)
`Number.isFinite(0)`이 참이라 가드를 뚫고, core가 `high >= takeProfitPrices[0]`로 채점하므로
목표가 0이면 **항상 달성**으로 보고. `entry 0.00` / `SL 0.00`도 동일.
→ `isFiniteNumber` → `isPositivePrice`(`> 0`). trader는 이미 `isFinitePositive`라 안전했고
   이제 두 소비자 기준이 일치. 프롬프트를 **실제로 렌더**해야만 보이는 결함이었다.

## 결함 2 — 배포 게이트가 완전 무력 (trader PR #59, **머지 완료**)
`?ready=true`가 **컬럼이 없어도 `ready: true`** 반환. drizzle-orm이 드라이버 에러를
`DrizzleQueryError`로 감싸 SQLSTATE가 `err.cause.code`에 있는데 `err.code`를 읽고 있었다.
`postgres-js`·`pg`·프로덕션 `neon-serverless` 전부 같은 경로 → **모든 환경에서 게이트가 장식**.

**테스트가 못 잡은 이유가 핵심**: `Object.assign(new Error(), {code})`라는
**프로덕션에 존재하지 않는 납작한 모양**을 던졌다. 가드와 테스트가 같은 틀린 가정을 공유해
버그가 배포돼도 전부 초록. 실물 DB에 붙이기 전엔 알 수 없었다.
→ `extractSqlState`가 cause 체인을 깊이 제한하며 탐색. 테스트는 `drizzleWrapped`로 실제
   중첩 재현(설치된 `drizzle-orm@0.45.2` 소스와 대조 확인).

### 부수: 내가 쓴 주석의 사실 오류
JSDoc에 `isNeonTransientError.ts`를 선례로 인용했는데 그 파일은 **siglens에 있고 trader엔 없다.**
주장 자체는 맞아서(그 파일이 같은 이유로 cause를 훑음) 자매 레포임을 명시하는 쪽으로 정정.

### 부수: 안전한 방향만 지키던 테스트
기존 SQLSTATE 테스트들이 "정상 DB를 unhealthy로 오판 안 함"만 검증 — **탐색을 통째로 지워도 통과**.
cause 안쪽에만 코드가 있는 케이스를 추가해 탐색 자체를 고정.

## 최종 상태
| PR | 결과 |
|---|---|
| siglens #784 | MERGED 09-04 00:23 |
| trader #57 | MERGED 09-04 00:28 |
| siglens #786 (0 가격) | MERGED 09-05 05:58 |
| trader #59 (게이트) | MERGED 09-05 06:05 |

## 배포 순서 (변경 없음)
1. **trader: `yarn db:migrate` 먼저** → 그 다음 이미지 배포.
   이제 `?ready=true`가 실제로 이 실수를 잡는다(fail-open이라 정상 배포는 안 죽임)
2. siglens: 마이그레이션 순서 무관(적용 전엔 이력만 안 쌓임)

---

# 라운드 3 (09-05): `reconciledLevels` 무시 — 매핑 계층 우회가 가린 결함

## 어떻게 나왔나
사용자 질문: "프롬프트 구현하는 함수 직접 호출해서 모든 값 다 잘 들어가는지도 확인했고?
**DB에서 데이터 불러왔다는 가정하에**"

이전 시뮬레이션은 `PriorAnalysis`를 **손으로 만들어** 넣었다 — 즉 매핑 계층
(`toPriorAnalysis`)을 통째로 건너뛴 것. 실제 저장 형태(`AnalysisResponse` jsonb)를
repository에 통과시키자 바로 나왔다. **매핑을 건너뛴 시뮬레이션은 검증이 아니다.**

## 결함
core는 AI 손절·익절이 무효할 때 원본을 **그대로 두고** 보정값을 `reconciledLevels`에
따로 붙인다 — *"The original AI fields above are never mutated"*. siglens는 원본만 읽어
**core가 이미 거부한 값**을 집어 왔다.

같은 저장 행, 두 매핑:
```
원본:   entry 148.00-150.00, TP 1.00/165.00,   SL 200.00 -> stop breached, target reached
보정값: entry 148.00-150.00, TP 158.00/165.00, SL 144.00 -> stop breached, target not reached
```
**달성 ↔ 미달이 뒤집힌다.** 채점기가 `takeProfitPrices[0]`(최근접 목표)을 쓰는데
무효 사다리 값 `1`이 첫 칸이라 `high >= 1`이 항상 참. trader의 `safe-extract.ts`는
이미 보정값을 우선하고 있었다 — 두 소비자가 갈라져 있었음.

## PR #787
`resolveEffectiveActionLevels()`를 `entities/analysis/lib/effectiveActionLevels.ts`로
추출하고 **두 소비자**에 적용:
- `analysisHistoryRepository.toPriorAnalysis` (프롬프트 히스토리)
- `widgets/analysis/utils/buildExpertAnalysisReport` (전문가 리포트 텍스트) — 같은 버그가
  그대로 남아 있었다(MISTAKES.md §6.7). 후속으로 미루지 않고 같이 고침

두 테스트 모두 **되돌림 검증**: 보정 우선 분기를 빼면 의도한 케이스만 정확히 깨진다.

## 리뷰 봇 Blocker 반려 (false positive)
봇 주장: `ReconciledActionLevels`는 `{exit, riskReward, reason}` 산문 필드만 가진다,
숫자는 `extractReconciledActionLines`로 파생해야 한다.

실제 core 타입(`dist/domain/types.d.ts:1213`)에 `stopLoss?: number`,
`takeProfitPrices?: readonly number[]`가 **실재**. 산문 3필드가 필수·숫자 2필드가
optional인 게 차이다. 봇은 산문만 읽는 UI 소비처(`AnalysisPanel.tsx` — 툴팁 텍스트만
필요)에서 타입 전체를 **역추론**했다.

`extractReconciledActionLines`는 대안이 못 된다 — 반환 타입 JSDoc이 명시하듯
**"AI 원본과 값이 다른 인덱스만"** 담는 차트 오버레이 전용(중복 라인 렌더 방지).
히스토리·리포트엔 **완전한** 레벨 집합이 필요.

봇의 Suggestion 2건은 유효해서 둘 다 반영.

## 상태
- 게이트: typecheck 0, lint 0(경고 0), test 12023 passed / 2 skipped
- ci·e2e·react-doctor 전부 pass
- claude-review 2회차는 **워크플로 자체가 fail** — "시스템 에러 또는 API 한도 초과로
  코드 리뷰를 시작하지 못했습니다". Draft 토글로 재트리거 중

## PR #787 리뷰 5라운드 (09-05) — 봇이 결함 2건을 더 잡음

| 라운드 | 봇 Blocker | 판정 |
|---|---|---|
| 1 | `ReconciledActionLevels`가 산문 필드만 갖는다 | **반려** → 봇 철회 |
| 2 | `let`+`if`가 MISTAKES §14 위반 | 반영(단 제안 코드는 FF 1-E 위반이라 다른 형태로) |
| 3 | `buildKeyLevelsBlock`이 파라미터 무시하고 재계산 | **적중** — 내 치환 실패 |
| 4 | `entryPrices` 무검증 | **적중** — 내 JSDoc이 스스로 지적해 놓고 안 고침 |
| 5 | 없음 → **APPROVED** (Suggestion 1건 반영) |

### 라운드 1 — 봇이 타입을 역추론해 없는 필드라 단정
`ReconciledActionLevels`에 `stopLoss?: number`·`takeProfitPrices?: readonly number[]`가
**실재**한다(`types.d.ts:1213`). 산문 3필드가 필수, 숫자 2필드가 optional인 게 차이.
봇은 산문만 읽는 UI 소비처(툴팁용)에서 타입 전체를 유추했다.

**코멘트 반박은 안 통했다** — 2라운드에도 동일 blocker 재발. `feedback_verify_review_bot_claims`의
기법대로 **PR 본문에 "⚠️ Known false positive" 섹션**으로 타입 원문을 게시하니 철회됐다.

### 라운드 3 — 내 치환이 조용히 실패
파일 하나에서 치환 4건 중 1건만 앵커가 안 맞았는데 `assert`를 안 걸어 no-op으로 통과.
결과: 함수가 `effectiveLevels`를 **받아 놓고 안에서 재계산**. 나머지 3건이 정상이라 안 보였다.

안전망이 전부 없었던 이유:
- **포매터가 앵커를 바꾼다** — 커밋 훅 prettier가 줄바꿈을 재배치해 내가 방금 쓴 코드조차
  다음 편집의 앵커로 못 쓴다
- **`tsc`가 안 잡는다** — `noUnusedParameters` 미설정(레포 전체 위반은 1건뿐)
- **동작 테스트로도 원리상 불가** — 호출부가 같은 값을 넘기므로 재계산이든 전달이든 결과 동일

### 라운드 4 — `entryPrices`만 무방비
`stopLoss`/`takeProfitPrices`는 필터를 거치는데 `entryPrices`는 원본 그대로였다.
`EffectiveActionLevels`에 넣어 **세 소비처**(entryZone·entryAnchor·toPriorAnalysis)를 통일.
core는 진입가를 보정하지 않으므로 여긴 보정 우선이 아니라 **검증만** 적용.

### core 승격 질문 — 앱 레이어로 결론
봇이 CLAUDE.md cross-repo scope guard를 들어 core 이관 여부를 물었고, 승인 리뷰에서
봇 스스로 "core가 이미 계산해 둔 값을 소비하는 어댑터 레이어라 scope guard 대상 아님"에 동의.
근거: core 타입이 *"consumers can compare and decide which values to display"*를 명시하고,
소비자마다 답이 다르다(차트=원본과 다른 값만 / 프롬프트·리포트=완전한 집합).

## 최종 상태
| PR | 결과 |
|---|---|
| siglens #787 | APPROVED·CLEAN, 커밋 6개 (`14c9b5e`…`9a9a14c`) |

배포 순서는 변경 없음 — **trader `yarn db:migrate` 먼저**, siglens는 순서 무관.
품질 측정(실제 LLM A/B)은 여전히 미실행.
