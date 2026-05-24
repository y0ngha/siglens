# 종합 분석에 옵션 axis 통합 — 설계 문서

- 작성일: 2026-05-22
- 작성자: y0ngha (with Claude)
- 상태: brainstorming 완료, plan 작성 대기

## 1. 배경

`/[symbol]/overall` 종합 분석은 현재 `'technical' | 'fundamental' | 'news'` 3축으로
구성되어 있다. 옵션 분석 모듈(`@y0ngha/siglens-core` 안에 `submitOptionsAnalysis`,
`pollOptionsAnalysis`, `OptionsAnalysisResponse`로 1급 모듈로 구현 + siglens 앱의
`/[symbol]/options` 페이지로 노출)은 종합 분석과 분리되어 있다.

본 작업은 옵션 분석을 종합 분석의 **4번째 axis로 격상**하여, 다른 3축과 동일한
dependency-axis 패턴으로 통합하는 것이 목적이다.

> 참고: 시장 분위기(fearGreed)는 현재 별도 axis가 아니라 overall prompt에 sentiment
> context로 즉석 주입되는 형태로 남아 있다. 이번 작업의 scope에는 포함되지 않는다.

## 2. 핵심 가정 (확정된 9가지 결정)

| # | 항목 | 결정 |
|---|---|---|
| 1 | NoChains 종목(인덱스/일부 ETF) | Graceful skip — 옵션 axis만 빠지고 다른 3축으로 종합 진행. `optionsBulletsKo` 빈 배열 |
| 2 | Daily limit | overall layer가 usage 소유. dependency resolver가 options axis usage drop (다른 3축과 동일) |
| 3 | 캐시 무효화 | cache key signature 변경으로 기존 종합 분석 캐시 즉시 폐기. `CACHE_KEY_SCHEMA_VERSION` bump 불필요 |
| 4 | 옵션 axis 실패 (LLM/네트워크 등) | Hard fail (다른 3축과 동일). NoChains는 별개 정상 상태로 분리 |
| 5 | UI 순서 | Headline → Technical → **Options** → Fundamental → News → IntegratedConclusion → Scenario → Risk |
| 6 | Conclusion 이름 | `ThreeAxisConclusion` → **`IntegratedConclusion`**, 필드명 `threeAxisConclusionKo` → `integratedConclusionKo` |
| 7 | Expiration | 가장 가까운 만기 1개, **0DTE 회피** (`expirationDate ≥ today+3d` 중 최소). core 타입 변경 없이 dependency resolver에서 snapshot.chains 정렬해 선택. 0DTE만 존재하면 가장 가까운 것으로 fallback |
| 8 | OI Stale (장 외 시간 OI snapshot stale) | 분석은 진행 + done 상태 옵션 섹션에 stale 배지 + 재분석 버튼 강조 |
| 9 | 재분석 버튼 | done 상태에 항상 노출. OI stale 시 강조. **rate 차감 안내 표시 없음** (현재 차감 정책 미사용). 클릭 시 **4축 전체 force-refresh** |

## 3. siglens-core 변경 표면

### 3-1. 타입 (`src/application/overall/types.ts`)

```typescript
export type OverallAxis = 'technical' | 'fundamental' | 'news' | 'options';

export interface OverallDependencyInputs {
    // ... 기존 필드 유지 ...
    /** Pre-fetched options snapshot. Caller fetches via OptionsDataProvider. */
    optionsSnapshot?: OptionsSnapshot;
    /** Per-axis options for options analysis (mirrors technical/fundamental/news). */
    options?: Pick<
        SubmitOptionsAnalysisOptions,
        'usage' | 'tier' | 'tierConfig' | 'modelId' | 'userApiKey' | 'waitUntil'
    >;
    /** OI snapshot staleness marker forwarded to the prompt and the response. */
    optionsOiStale?: boolean;
}
```

`pendingJobs: Record<OverallAxis, string | undefined>`는 union 확장에 따라 자동으로 `options` 포함.

### 3-2. 응답/도메인 타입 (`src/domain/types.ts`)

```typescript
export interface OverallAnalysisResponse {
    headlineKo: string;
    technicalBulletsKo: string[];
    fundamentalBulletsKo: string[];
    newsBulletsKo: string[];
    optionsBulletsKo: string[];          // NEW
    integratedConclusionKo: string;      // RENAMED from threeAxisConclusionKo
    scenarios: OverallScenario[];
    riskFactorsKo: string[];
    optionsOiStale?: boolean;            // NEW — UI stale 배지
}
```

`RawOverallAnalysisResponse`도 동일하게 확장(unknown 입력 검증용). 기존
`threeAxisConclusionKo`는 backward-compat 받지 않음(캐시 무효화 정책).

### 3-3. Dependency Resolver (`src/application/overall/dependencyResolver.ts`)

- `Promise.all`에 4번째 `submitOptionsAnalysis` 추가
- `inputs.optionsSnapshot === undefined` → 옵션 호출 skip → `{ kind: 'options_skipped' }`
- `submitOptionsAnalysis` 응답이 `no_chains_error` → graceful skip (`{ kind: 'options_skipped' }`)
- `error`/`key_error`/`limit_error` → 다른 axis와 동일하게 surface (`kind: 'error', axis: 'options'`)
- `dropAxisUsage=true`이면 `options.usage`도 strip
- 새 helper `pickNearestExpiration(snapshot, now)`: `expirationDate ≥ today+3d` 중 최소, 없으면 `expirationDate ≥ today` 중 최소

`DependencyState`에 `'options_skipped'` 분기 추가:

```typescript
type DependencyState =
    | { kind: 'cached', technical, fundamental, news, options: OptionsAnalysisResponse | null }
    | { kind: 'pending', pendingJobs: Record<OverallAxis, string | undefined> }
    | { kind: 'error', axis: OverallAxis, error: ... }
    | { kind: 'miss_no_trigger' };
```

옵션 skipped된 경우 `options: null`로 cached 분기에 포함되어 prompt 빌더로 전달.

### 3-4. submitOverallAnalysis (`src/application/overall/submitOverallAnalysis.ts`)

- `buildOverallCacheKey(symbol, timeframe, modelId, inputHash)`의 `inputHash`에
  옵션 결과/입력 해시 포함 → cache key signature 자연 변경 → 기존 캐시 무효화
- `buildOverallAnalysisPrompt` 시그니처에 옵션 결과(또는 null) + `optionsOiStale` 추가
- normalize 결과의 `optionsOiStale`은 입력값 그대로 echo

### 3-5. Prompt (`src/domain/analysis/overallPrompt.ts`)

- 시그니처: `buildOverallAnalysisPrompt(symbol, companyName, technical, fundamental, news, timeframe, fearGreed?, options?, optionsOiStale?)`
- 4축 출력 스키마: `optionsBulletsKo: string[]` 추가, `integratedConclusionKo` 리네임
- 옵션이 null/빈 컨텍스트일 때: "옵션 분석 대상 없음, optionsBulletsKo는 빈 배열 유지" 명시
- `optionsOiStale=true`일 때: "Options OI snapshot may be stale (outside regular session)" 힌트

### 3-6. Normalizer (`src/domain/analysis/normalizeOverall.ts`)

- `optionsBulletsKo` 검증/정규화 (`string[]` 보장, 누락 시 빈 배열 fallback)
- `integratedConclusionKo` 검증
- `optionsOiStale` 외부 입력값 그대로 응답에 echo (LLM이 결정하지 않음)

### 3-7. 캐시 무효화

- `inputHash` 계산에 옵션 결과/입력이 포함되면 자연 무효화
- `CACHE_KEY_SCHEMA_VERSION` bump는 불필요
- PR description에 "기존 종합 분석 캐시 무효화" 명시

## 4. siglens 앱 변경 표면

### 4-1. Hook (`src/components/overall/hooks/useOverallAnalysis.ts`)

- `AXIS_ORDER`에 `'options'` 추가
- `pollDependencyJob` switch에 `case 'options': return pollOptionsAnalysisAction(jobId);`
- `getPageHideJobs` 매핑에 옵션 분기 추가 (`{ jobId: current.jobs.options, type: 'options' }`)
- `useEffect` unmount cleanup에 `cancelOptionsAnalysisJobAction` 호출 추가
- `trigger` (재분석): 기존 `refetch()`가 4축 전체 force-refresh를 트리거하도록 `submitOverallAnalysisAction`에 `force=true` 전달. core의 `OverallDependencyInputs`는 현재 `technical.force`만 정의되어 있음 — 본 작업에서 다른 3축에도 `force?: boolean` 필드를 추가하거나, `OverallDependencyInputs.force?: boolean` top-level 옵션을 추가하여 resolver가 4축 모두에 적용하도록 한다. 구체 구현 방식은 plan에서 결정

### 4-2. Server Action (`src/infrastructure/market/submitOverallAnalysisAction.ts`)

- 옵션 snapshot fetch (`YahooOptionsAdapter` 또는 기존 `optionsDataCache` 패턴 재사용)
- `isOpenInterestSnapshotStale(snapshot)` + `isUsOptionsRegularSession(new Date())`로
  `optionsOiStale` 판정 (lib/options 기존 함수)
- NoChains 종목이면 `optionsSnapshot=undefined` 전달
- core resolver에 `optionsSnapshot`, `options`, `optionsOiStale` forward
- `force` 파라미터 들어오면 4축 axis 옵션에 모두 force 적용 (core의 `OverallDependencyInputs` force 표면을 따라감 — 위 4-1 참고)

### 4-3. OverallContent (`src/components/overall/OverallContent.tsx`)

```tsx
<OverallSummary headline={r.headlineKo} />
<TechnicalSummary bullets={r.technicalBulletsKo} />
<OptionsSummary bullets={r.optionsBulletsKo} oiStale={r.optionsOiStale ?? false} />
<FundamentalSummary bullets={r.fundamentalBulletsKo} />
<NewsSummary bullets={r.newsBulletsKo} />
<IntegratedConclusion text={r.integratedConclusionKo} />
<ScenarioAnalysis scenarios={r.scenarios} />
<RiskFactors factors={r.riskFactorsKo} />
<ReanalyzeButton onClick={trigger} highlighted={r.optionsOiStale ?? false} />
```

### 4-4. 신규/리네임 컴포넌트

| 파일 | 변경 |
|---|---|
| `src/components/overall/sections/OptionsSummary.tsx` | **신규**. TechnicalSummary 패턴. `oiStale` props로 stale 배지. NoChains/skipped 분기는 "분석 대상 옵션 없음" |
| `src/components/overall/sections/ThreeAxisConclusion.tsx` → `IntegratedConclusion.tsx` | 파일 리네임 + 컴포넌트명/heading 텍스트 갱신 |
| `src/components/overall/ReanalyzeButton.tsx` | **신규**. `highlighted` props에 따라 스타일. rate 차감 안내 없음 |

### 4-5. Chat State (`src/components/overall/utils/buildChatState.ts`)

- chat 컨텍스트에 `optionsBulletsKo` 포함
- `threeAxisConclusionKo` → `integratedConclusionKo` 필드 매핑 갱신

### 4-6. Domain types (`src/domain/types.ts`)

- `CancelJobEntry.type`은 이미 `'options'` 포함 — 변경 없음

### 4-7. Page (`src/app/[symbol]/overall/page.tsx`)

- SEO 가이드/FAQ 문구를 4축 + 시장 분위기로 갱신
- 본문에 "옵션 시장이 어떻게 평가하는지" 한 문장 추가

## 5. Data Flow

```
[siglens 앱]                                    [siglens-core]
─────────────                                   ────────────────
OverallContent
   ↓ useOverallAnalysis(symbol, tf, modelId)
   ↓ trigger()
submitOverallAnalysisAction(symbol, ...)
   │
   ├─ fetchAssetInfo / fetchNewsItems / ...     (기존 패턴)
   ├─ fetchOptionsSnapshot(symbol)              NEW
   │     ↓
   │  isOpenInterestSnapshotStale(snapshot) → optionsOiStale: boolean
   │     ↓
   │  NoChains snapshot이면 optionsSnapshot=undefined
   │
   └─→ submitOverallAnalysis({
            ...,
            optionsSnapshot, options: {...}, optionsOiStale,
            tier, userApiKey, usage,
       })
                                                ↓
                                       resolveOverallDependencies(inputs, { dropAxisUsage: true })
                                                ↓
                                       Promise.all([
                                           submitAnalysis(...),
                                           submitFundamentalAnalysis(...),
                                           submitNewsAnalysis(...),
                                           optionsSnapshot
                                               ? submitOptionsAnalysis({
                                                   expirationDate: pickNearestExpiration(snapshot, now),
                                                   snapshot, modelId, ...
                                                 })
                                               : { kind: 'options_skipped' }
                                       ])
                                                ↓
                                       각 axis status 검사
                                       (error/key_error/limit_error → surface,
                                        miss_no_trigger → short-circuit,
                                        no_chains_error → options_skipped graceful)
                                                ↓
                                       모든 axis 준비 완료:
                                          buildOverallAnalysisPrompt(..., options, optionsOiStale)
                                          → worker dispatch
                                                ↓
앱 측 4축 polling
   ↓
OverallAnalysisResponse {
   headlineKo,
   technicalBulletsKo, optionsBulletsKo,
   fundamentalBulletsKo, newsBulletsKo,
   integratedConclusionKo,
   scenarios, riskFactorsKo, optionsOiStale,
}
   ↓
OverallContent done 렌더
```

## 6. 에러/예외 처리 매트릭스

| 상황 | 위치 | 처리 |
|---|---|---|
| 옵션 미상장 (snapshot 빈) | 앱 action | `optionsSnapshot=undefined` 전달 |
| core가 `optionsSnapshot=undefined` 받음 | core resolver | `submitOptionsAnalysis` 호출 안 함 → `kind: 'options_skipped'` |
| `submitOptionsAnalysis`가 `no_chains_error` | core resolver | graceful skip (`kind: 'options_skipped'`) |
| skipped된 경우 prompt | core prompt | "옵션 데이터 없음, optionsBulletsKo는 빈 배열로" 명시 |
| OI stale (장 외 시간) | 앱 action | `optionsOiStale=true` 전달, core normalizer가 응답에 echo |
| OI stale + 결과 정상 | UI | OptionsSummary stale 배지, ReanalyzeButton highlighted |
| 옵션 axis LLM/네트워크 실패 | core resolver | `error`/`key_error` surface, 앱 `state.status='error'`, axis='options' |
| 옵션 daily limit (overall 내) | core resolver | `dropAxisUsage`로 axis usage 차감 안 함. overall layer가 1회만 차감 |
| 옵션 BYOK 필요 | core resolver | `key_error` surface |
| 옵션만 pending, 다른 cached | core resolver | `kind: 'pending'`, `pendingJobs.options=jobId` |
| skipEnqueueIfMiss + 옵션 cache miss | core resolver | 다른 axis와 동일 `miss_no_trigger` |
| fearGreed 실패 | core submit | 기존 동작 유지 (null fallback) |
| 재분석 버튼 클릭 | 앱 hook | `trigger()` → `refetch()` → 4축 전체 force-refresh |

## 7. 테스트 전략

### 7-1. siglens-core

- `application/overall/dependencyResolver`: 4축 cached / 옵션만 submitted / 옵션 NoChains graceful / 옵션 limit_error surface / `dropAxisUsage` 옵션 usage strip / `optionsSnapshot=undefined` 호출 skip
- `application/overall/submitOverallAnalysis`: 4축 prompt 빌드 / options_skipped 시 prompt 힌트 / `optionsOiStale` echo / cache key 옵션 입력으로 변경됨
- `application/overall/pickNearestExpiration`: 오늘+3d 이상 최소 / 모든 만기 3일 이내면 fallback / 빈 chains
- `domain/analysis/normalizeOverall`: optionsBulletsKo / integratedConclusionKo / 누락 fallback
- `domain/analysis/overallPrompt`: 시그니처 변경 호환성

### 7-2. siglens 앱

- `useOverallAnalysis`: 4축 polling / 옵션만 pending / 옵션 skipped 종료 / cancel cleanup 4축 / refetch 4축 force
- `submitOverallAnalysisAction`: optionsSnapshot fetch 성공·실패·NoChains, OI stale 판정
- `OverallContent`: OptionsSummary 위치(Technical 직후) / IntegratedConclusion 리네임 / 재분석 버튼 / OI stale 강조 / NoChains 안내
- `OptionsSummary`: bullets 렌더 / stale 배지 / 빈 배열 분기
- `buildChatState`: optionsBulletsKo / integratedConclusionKo

### 7-3. 통합/회귀

- 기존 종합 분석 캐시 무효화 (cache key 직접 비교)
- ETF/Index NoChains 경로 end-to-end (fixture)

## 8. 작업 순서 (Phase별)

| Phase | 작업 | 병렬 가능? |
|---|---|---|
| **Phase 0** | brainstorming (이 문서) | — |
| **Phase 1** | writing-plans로 implementation plan 작성 | — |
| **Phase 2** | 양쪽 워크트리 생성 | 단일 |
| **Phase 3 (Hard 병목)** | core: 타입 표면만 (OverallAxis 확장, OverallAnalysisResponse 필드 추가, OverallDependencyInputs 필드 추가) + `yarn build` → siglens 앱 node_modules sync | 단일, 5-10분 |
| **Phase 4 (완전 병렬)** | core 워크트리: dependencyResolver, submitOverallAnalysis, prompt, normalize, pickNearestExpiration, 테스트<br>siglens 워크트리: useOverallAnalysis, submitOverallAnalysisAction, OverallContent, OptionsSummary, IntegratedConclusion 리네임, ReanalyzeButton, 테스트 | **양쪽 subagent 동시 dispatch** |
| **Phase 5 (통합 검증)** | core 최종 `yarn build` → siglens node_modules sync → siglens 앱 실제 동작 확인 | 단일 |
| **Phase 6 (PR 작성)** | **양쪽 PR 동시 개시**, cross-link | 병렬 |

## 9. 워크트리 셋업

```bash
git -C /Users/y0ngha/Project/siglens-core worktree add \
    /Users/y0ngha/Project/siglens-core-overall-options \
    -b feat/overall-options-axis main

git -C /Users/y0ngha/Project/siglens worktree add \
    /Users/y0ngha/Project/siglens-overall-options \
    -b feat/overall-options-axis master
```

## 10. 빌드 산출물 동기화 흐름

Phase 3, Phase 5에서 사용. plan에 정식 step으로 포함.

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn build

rsync -a --delete \
    /Users/y0ngha/Project/siglens-core-overall-options/dist/ \
    /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/
```

## 11. PR 전략

- **PR 개시는 양쪽 동시 진행** (core PR + siglens 앱 PR 동시 생성, cross-link)
- **머지는 core 먼저 → siglens 앱 나중** (의존성 방향 준수)
- **core publish 버전업은 사용자가 직접 진행** — 양쪽 PR description에 다음 문구 명시:
  > **Publish note**: `@y0ngha/siglens-core` 버전업 및 npm publish는 사용자가 직접 수행합니다. core PR 머지 → 사용자 publish → siglens 앱 PR 머지 순서로 진행해주세요.
- 양쪽 PR description에 "회귀 위험: 종합 분석 캐시 전부 무효화" 명시
- 양쪽 PR을 cross-link (서로의 PR URL을 description에 기재)

## 12. 병목 정리

- **Hard 병목 1건**: Phase 3 (타입 표면 빌드 + sync). 5-10분 분량, 병렬화 의미 없음
- **신규 API 필요 없음**: `submitOptionsAnalysis`/`pollOptionsAnalysis`/`cancelOptionsAnalysisJobAction` 모두 core/앱에 이미 존재
- **Soft 동기화**: Phase 5에서 core 빌드 산출물 최종 sync 1회. 자동화 가능

## 13. 후속 작업 (out of scope)

- fearGreed를 axis로 격상하는 작업 (현재는 prompt sentiment context로 유지)
- 옵션 분석 자체의 만기 multi-pick 확장 (`nearest-3` 등)
- 종합 분석 페이지에 옵션 페이지로의 deep-link card 강화
