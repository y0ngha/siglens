# 분석 이력 참조 (Prior-Analysis Context) — 설계

> 3개 레포 동시 적용: `siglens-core`(프롬프트·정책), `siglens`(DB·주입), `siglens-trader`(DB·주입).
>
> **기준 시점 2026-09-02** — siglens `v0.69.1` / core pin `0.54.0` / trader `v0.28.5`(core pin `0.50.2`).

## 1. 목표

AI 분석 시 같은 심볼·타임프레임의 **과거 분석 N건 + 그 이후 실제 가격 결과**를 프롬프트에
넣어, 분석 간 일관성을 올리고 모델이 자기 오판을 인지하게 한다. 이력이 없으면 현재와
100% 동일하게 동작한다(바이트 동일 프롬프트).

## 2. 비목표

- 과거 분석을 근거로 한 자동 매매 판단 변경 (trader `trade-gate.ts` 불변)
- 크로스 심볼 / 크로스 타임프레임 참조
- technical·overall 외 6축 (1차 범위 밖 — §4-4a)

## 2-1. 확정된 결정 3건 (2026-09-02)

| 항목 | 결정 |
|---|---|
| 프롬프트 원문 | **저장한다** — stable 중복 제거 + dynamic 인라인 (§7) |
| 모델 스코프 | 저장은 모델별, **읽기는 모델 무시** (§5-4) |
| 1차 범위 | siglens: **technical + overall** / trader: **technical 단독** |

---

## 3. 핵심 결정 4가지

### 3-1. 윈도는 벽시계가 아니라 **봉 개수**로 자른다

시간으로 자르면 장중 타임프레임이 밤·주말에 통째로 빈다. 5Min 개장 직후엔 직전 분석이
17시간 전이라 어떤 벽시계 컷을 잡아도 매일 아침 이력이 0이 된다.

봉 배열은 이미 프롬프트 빌더 인자로 들어와 있고 세션 갭이 이미 제거돼 있다. 봉을
앵커로 쓰면 세션 계산 코드 없이 정확해진다.

```
anchorTime = bars.at(-(HISTORY_LIMIT * HISTORY_SLACK))?.time
후보       = priorAnalyses.filter(a => a.generatedAt >= anchorTime)
```

> `Bar.time`은 **초 단위 Unix 타임스탬프(number)**다. `Date`도 ISO 문자열도 아니다.

- `HISTORY_LIMIT = 7` — 프롬프트에 넣을 최대 건수
- `HISTORY_SLACK = 3` — 버퍼. 분석이 매 봉 있진 않으니 3배 범위를 훑어 최신 7건을
  채운다. 희소 종목이면 1~2건만, 그것도 없으면 섹션 자체 생략.

| tf | 21봉 백스톱 | 실질 |
|---|---|---|
| 5Min | 105분 거래시간 | 전일 후반까지 |
| 15Min | 5시간 15분 | 당일~전일 |
| 30Min | 10시간 30분 | 1.5 거래일 |
| 1Hour | 21시간 | 3 거래일 |
| 4Hour | 84시간 | 2주 |
| 1Day | 21 거래일 | 약 1개월 |

`HISTORY_SLACK`이 유일한 튜닝 노브. trader에 이미 있는 `getTechnicalMaxAgeMs`
(15Min→45분 = 3×15분)와 같은 배율이라 선례와 일치.

`bars` 길이는 충분하다 — `PROMPT_CONFIG_BY_TIMEFRAME.recentBarsCount`는 30~48이지만
그건 **표시용 슬라이스**일 뿐이고 `bars` 원본은 지표 계산에 필요한 만큼 훨씬 길다.
그래도 방어적으로: `bars.length < HISTORY_LIMIT * HISTORY_SLACK`이면 `bars[0]`을
앵커로 쓴다(이력 전체 허용). 벽시계 폴백은 두지 않는다.

### 3-2. 같은 봉의 중복 분석은 접는다

`force` 재분석, 여러 사용자 트리거, **그리고 4개 로케일**(§3-3) 때문에 한 봉에
여러 행이 생긴다. 접지 않으면 "과거 7건"이 전부 같은 봉의 것이 된다.

```
봉 타임스탬프로 그룹 → 그룹당 1건 → 최신순 HISTORY_LIMIT건
```

그룹 내 선택은 **결정론적이어야 한다**(캐시 키 안정성 §4-5): `generatedAt` 최신,
동률이면 `id` 오름차순. 로케일을 타이브레이크에 쓰지 않는다 — 쓰면 로케일마다
다른 이력이 뽑혀 캐시 키가 갈라진다.

### 3-3. 이력 다이제스트는 **로케일 프리**로 만든다 ← 이번 갱신의 핵심

core 0.53.0부터 AI 산출물이 `ko`/`en`/`ja`/`zh` 4개 로케일로 나온다
(`AnalysisLocale`, 캐시 키 축, `runOverallAnalysisAction(…, locale, …)`).

다이제스트에 산문(`summary`, `actionRecommendation.entry` 등)을 넣으면 로케일마다
이력이 갈라지고, 영어 프롬프트에 한국어 과거 요약이 섞인다. 그래서 다이제스트는
**숫자·enum만** 쓴다: `trend`, `riskLevel`, `entryPrices`, `stopLoss`,
`takeProfitPrices`. 전부 언어 중립.

결과:
- 이력 풀이 로케일 간 **공유**된다 → 같은 심볼·타임프레임의 데이터가 4배 조밀
- 로케일이 캐시 키를 갈라도 **이력 지문은 동일** → 축 폭발 없음
- `locale` 컬럼은 저장하되 **읽을 때 필터하지 않는다**(감사용)

섹션 헤더·가드레일 문구만 요청 로케일로 렌더한다.

### 3-4. 과거 판단만 넣지 말고 **결과**를 붙인다

과거 자기 출력만 재주입하면 자기강화(앵커링)가 된다. `bars`가 이미 있으므로 그
시점 종가와 이후 최고/최저를 조회해 결과를 계산한다 — 추가 fetch·컬럼 0.

```
## Prior Analyses (AAPL · 1Day · 참고용)
- 21봉 전 (2026-08-01) bullish/medium · entry 178.0 / TP 195.0 / SL 172.0
  → 이후 최고 181.2 (+1.8%), 최저 170.4 · SL 이탈, TP 미달 · 현재 172.4 (-3.1%)
- 10봉 전 (2026-08-16) neutral/medium · 진입 권고 없음
  → 이후 +0.8%
- 3봉 전 (2026-08-25) bearish/high · entry 174.0 / TP 165.0 / SL 179.0
  → 이후 최저 171.9 · TP 미달, SL 미이탈 · 현재 172.4 (-0.9%)
```

**필수 가드레일 문구**(앵커링 방지, 이거 빼면 기능이 해가 된다):

```
위 이력은 참고용이다. 현재 데이터와 충돌하면 언제나 현재 데이터가 이긴다.
과거 판단이 틀렸다면 명시적으로 뒤집고 무엇이 바뀌었는지 한 줄로 밝혀라.
이력을 근거로 방향을 유지하지 마라 — 근거는 항상 위의 계산된 데이터다.
```

기존 `ANTI_FABRICATION_GUARDRAIL`과 같은 성격의 상수로 export해 테스트가 정확한
문자열을 참조하게 한다(MISTAKES.md Tests #4/#13 관례).

토큰 비용: 7줄 × ~140자 ≈ 1KB. 무시 가능.

---

## 4. siglens-core 변경

### 4-1. 신규 타입

```ts
/** 소비자(siglens / trader)가 DB에서 읽어 전달하는 과거 분석 1건. 언어 중립. */
export interface PriorAnalysis {
  generatedAt: Date;
  trend: Trend;
  riskLevel: RiskLevel;
  entryPrices?: number[];
  stopLoss?: number;
  takeProfitPrices?: number[];
}
```

> `AnalysisResponse` 전체가 아니라 **납작한 축약형**을 받는다. core가 전체 JSON을
> 받으면 저장 스키마와 결합되고, 소비자마다 다른 저장 형태를 core가 알아야 한다.
> 축약은 소비자가 한다. `modelId`·`locale`도 받지 않는다 — 다이제스트에 안 쓴다.

Repository 인터페이스는 만들지 않는다. `usage_logs`와 달리 core가 쓰기를 하지 않고
읽기 결과를 받기만 하므로 배열 하나면 충분하다.

### 4-2. `SubmitAnalysisOptions` 확장

현재 필드(core 0.54.0): `marketDataProvider` `usage` `tierContext` `tierConfig`
`modelId` `userApiKey` `skipEnqueueIfMiss` `assetClass` `currency` `reasoning`
`locale` `positionBucket` `signal`.

여기에 추가:

```ts
/**
 * 같은 심볼·타임프레임의 과거 분석(최신순). 소비자가 DB에서 읽어 넣는다.
 * core가 봉 앵커로 다시 자르므로 소비자는 넉넉히 보내도 된다.
 * 생략 시 프롬프트·캐시 키 모두 기존과 바이트 동일.
 */
priorAnalyses?: readonly PriorAnalysis[];
```

`positionBucket`과 동일한 계약: 소비자가 만든 값 → `dynamic`에만 주입
(`stable`은 캐시 프리픽스라 오염 금지) → 캐시 키에 축 추가 → 생략 시 하위 호환.

### 4-3. 소비자용 쿼리 힌트 헬퍼

```ts
export function analysisHistoryQuery(timeframe: Timeframe): {
  limit: number;   // HISTORY_LIMIT * HISTORY_SLACK
  sinceMs: number; // ANALYSIS_CACHE_TTL[tf] * limit * 1000
};
```

DB WHERE 절은 봉을 모르므로 시간으로 대충 자르고, **정확한 컷은 core가 봉 앵커로**
다시 한다. 소비자가 정책을 복제하지 않게 하려는 것.

### 4-4. 프롬프트 주입 위치

**technical (`domain/analysis/prompt.ts`)**

`buildAnalysisPrompt(symbol, companyName, bars, indicators, skills, timeframe,
fearGreed, assetClass, positionBucket, locale, priorAnalyses?)` — 11번째 선택 인자.

`dynamic`의 **Fear & Greed 섹션 직후, `## Analysis Request` 직전**.
- `stable` 금지 — 호출마다 달라지는 값
- 스킬 샘플링 시드에 미포함 — 이력이 스킬 선택을 바꾸면 안 됨
- 꼬리의 Analysis Request 앞 — 출력 규칙이 마지막에 오는 현행 순서 유지

### 4-4a. 범위 — technical + overall만 (확정)

core에 프롬프트 빌더가 10개 있다: `prompt`(technical) `overallPrompt`
`fundamentalPrompt` `financialsPrompt` `newsPrompt` `marketNewsDigestPrompt`
`congressTrendPrompt` `newsCardPrompt` `marketBriefingPrompt` (+`systemPrompt`).
사용자 노출 분석축은 8개이고 SSE `DISPATCH`가 그중 7개를 라우팅한다.

"나머지도 같은 패턴"으로 넘길 수 없다. 축마다 다르다:

| 축 | 다이제스트에 쓸 필드 | 봉 앵커 |
|---|---|---|
| technical | trend / riskLevel / entry·TP·SL | 있음(`bars`) |
| overall | 통합 방향·시나리오 가격대 | 있음 — 단 §4-4b |
| fundamental / financials | 스코어카드 등급 변화 | **없음** — 분기 단위. 봉 대신 `generatedAt` 시간 컷 |
| news / marketNewsDigest | 감성 스코어 | **없음** — 뉴스는 창이 다름(수 시간) |
| congress | 순매수 방향 | **없음** — 공시 지연이 수 주 |
| options | OI 스큐 방향 | 있음 |

봉 앵커(§3-1)는 **봉이 있는 축에만** 성립한다. 나머지는 각 축의 캐시 TTL
(`FUNDAMENTAL_CACHE_TTL_SECONDS` 등)에 `HISTORY_SLACK`을 곱한 시간 컷으로 간다.

**확정: 1차는 technical + overall 두 축만.** 둘이 트래픽 대부분이고 봉 앵커가
그대로 성립한다. 나머지 6축은 효과 측정 후 별도 설계(봉 없는 축은 시간 컷).

**trader는 technical 단독.** trader의 분석축은 technical/news/options/
fundamental/congress 다섯이고 **`overall`이 없다**(`ANALYSIS_REASONING` 확인).
나머지 넷은 전부 봉 없는 축이라 1차 범위 밖.

### 4-4b. overall의 중첩 문제

`runOverallAnalysis`는 내부에서 `runAnalysisForOverall`로 technical을 호출해
그 **결과**를 overall 프롬프트에 넣는다. 따라서:

- technical 하위 호출은 자기 이력을 받는다(정상)
- overall 자신도 `tab='overall'` 이력을 별도로 받는다(정상)
- 이력 **텍스트**가 두 번 들어가진 않는다 — overall 프롬프트에 들어가는 건
  technical의 산출물이지 프롬프트가 아니므로

단, `priorAnalyses`를 overall 옵션으로 받아 하위 technical 호출에 **그대로
전달하면 안 된다**(tab이 다르다). core 내부에서 축별로 갈라야 한다.

### 4-5. 캐시 키 (siglens 전용 문제)

프롬프트가 달라지는데 키가 같으면 안 되고, 매 분석마다 키가 바뀌면 히트율이 죽는다.

#### ⚠️ 순서 제약 — 봉은 키 계산 시점에 없다

`runAnalysis`의 순서는 **티어 게이트 → 캐시 키 계산 → 캐시 조회 → (미스면) 봉
페치 → 프롬프트 조립**이다. 즉 **캐시 키를 만들 때 `bars`가 아직 없다.** 봉 앵커로
고른 집합의 지문을 키에 넣는 설계는 성립하지 않는다(초안의 결함, 2026-09-02 수정).

**해법: 2단 좁히기.**

| 단계 | 레이어 | 입력 | 하는 일 |
|---|---|---|---|
| 1. 키용 좁히기 | infrastructure (`cache/config.ts`) | `priorAnalyses`, `timeframe`, `now` | 현재 TTL 창 제외 → 최신순 `LIMIT*SLACK`건 → `generatedAt` 목록 해시 |
| 2. 프롬프트용 좁히기 | domain (`priorAnalysis.ts`) | 1의 결과, `bars` | 봉 앵커 → 봉 접기 → 최신 7건 |

1단계는 봉이 필요 없다(벽시계 + TTL만). 2단계는 봉이 생긴 뒤 프롬프트 조립 시점에
돈다.

**"같은 키 = 같은 프롬프트"가 깨지지 않나?** 이미 그 정도 오차는 현행 계약이
허용한다 — 캐시 키에 봉 데이터가 전혀 안 들어가므로, 같은 TTL 창 안의 두 호출은
지금도 마지막 봉이 갱신된 서로 다른 프롬프트를 같은 키로 공유한다. 2단계가
좁히는 폭은 그 기존 허용 오차 안이다.

**현재 TTL 창 제외(1단계)가 핵심이다.** A가 분석을 돌려 이력이 1건 늘어도 그 행은
현재 창에서 제외되므로 B의 키가 안 바뀐다. 창이 넘어가는 순간 A의 행이 편입되고
키도 함께 넘어간다.

#### 레이어 제약

`src/domain/**`는 `@/infrastructure/*`·`@/application/*` import가 **ESLint error**다
(`eslint.config.mjs`의 `no-restricted-imports`, `src/domain/CLAUDE.md`). 따라서
`ANALYSIS_CACHE_TTL`을 도메인에서 읽을 수 없고, 위 2단 분할이 그 제약과도 맞는다 —
TTL을 아는 1단계는 infrastructure에, 봉만 아는 2단계는 domain에 둔다.

키에는 1단계 지문 4자리를 축으로 추가한다.

**현재 시그니처**(core 0.54.0):
```ts
buildAnalysisCacheKey(symbol, timeframe, modelId?, skillFingerprint?,
                      reasoning?, positionBucket?, locale?)
```
→ `historyFingerprint?`를 **`locale` 뒤 마지막 축**으로 붙인다. 없으면 세그먼트
자체 생략(하위 호환). 이력이 로케일 프리(§3-3)라 4개 로케일 키가 같은 지문을
공유한다.

> trader는 항상 `force=true`로 core Redis 캐시를 우회하므로 이 절이 무관하다.

### 4-6. `PROMPT_TEMPLATE_VERSION` bump 필수

현재 `'p8'` → `'p9'`. 안 올리면 warm 심볼은 TTL 만료까지 새 프롬프트를 안 탄다.

### 4-7. 킬 스위치

`priorAnalyses`를 소비자가 안 보내면 즉시 끄는 것과 같다. core에 플래그 불필요 —
끄기는 소비자 env 한 줄로.

---

## 5. siglens 변경 (v0.69.1 기준)

### 5-1. 신규 테이블

기존 테이블과 겹치지 않는다 — `seo_analysis_snapshots`는 심볼×탭당 1행(이력 아님),
`shared_analyses`는 공유 스냅샷, 신규 `visitor_days`·`content_translations`는 무관.

```ts
export const analysisHistory = pgTable('analysis_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
    timeframe: varchar('timeframe', { length: 8 }).notNull(),
    tab: varchar('tab', { length: 16 }).notNull(),      // technical | overall | ...
    modelId: varchar('model_id', { length: 64 }).notNull(),
    locale: contentLocaleEnum('locale').notNull(),      // 감사용 — 읽기 필터 아님
    result: jsonb('result').notNull(),                  // 정규화된 AnalysisResponse 전체
    inputFingerprint: varchar('input_fingerprint', { length: 32 }),
    promptVersion: varchar('prompt_version', { length: 32 }),
    // 프롬프트 원문 — §7. 상수 조각은 해시로, 호출별 조각만 인라인.
    promptStableHash: char('prompt_stable_hash', { length: 64 }),
    promptSystemHash: char('prompt_system_hash', { length: 64 }),
    promptDynamic: text('prompt_dynamic'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index('analysis_history_lookup_idx')
        .on(t.symbol, t.timeframe, t.tab, t.generatedAt.desc()),
]);
```

- `result`에 전체 JSON — 오프라인 평가·백필용. 프롬프트엔 축약형만.
- `locale`은 기존 `contentLocaleEnum` 재사용.
- `promptVersion` — trader의 `appVersion` 선례. 프롬프트 세대 전후 비교용.
- `tab`은 1차에 `'technical' | 'overall'` 두 값만 들어온다.
- 보존: `result` 90일 / `prompt_dynamic` 7일(§7-1). 신규 크론 아님 — 기존
  prewarm 크론에 두 줄.

### 5-2. 쓰기 지점 — SSE 라우트 1곳

**Server Action이 아니다.** 실제 실행 경로는 `src/app/api/analysis/stream/route.ts`다.
8축 `DISPATCH` 테이블이 거기 있고 `getDatabaseClient()`도 이미 그 파일에서 쓰인다.
write 훅은 여기 한 곳에 붙는다 — 축마다 액션에 흩는 것보다 누락 위험이 낮다.

분석이 새로 생성될 때만(`status === 'done'`; `'cached'`는 이미 저장된 행).
`after()`로 비동기 write — 사용자 응답을 막지 않는다.

로케일 4개라 같은 봉에 최대 4행이 쌓인다(사후 번역 계층이 제거되고 8축 전부 core에
`locale`을 넘겨 **대상 언어로 직접 생성**하므로 로케일마다 별도 LLM 실행이다).
읽기 쪽 봉 접기(§3-2)가 흡수한다.

### 5-2a. 콜드스타트 ⚠️

siglens에는 백필 소스가 없다. `seo_analysis_snapshots`는 심볼×탭당 1행이고
`shared_analyses`는 공유 스냅샷이라 이력이 아니다. 즉 **배포 직후 이력 0**이고,
1Day는 21 거래일이 지나야 최대치에 도달한다. 이 기간 동안 siglens 쪽 효과는 0에
가깝다. trader는 `analysis_results`에 이미 데이터가 있어 첫날부터 효과가 난다.

### 5-3. 읽기 지점

프롬프트 빌드 **전**에 필요하므로 `runAnalysis` 호출부에서 조회 → 축약 →
`priorAnalyses` 주입. 대상 파일:

- `src/entities/analysis/api.ts` (`prewarmTechnical` 등 SEO seam)
- `src/entities/analysis/actions/run*.ts` 5종

`analysisHistoryQuery(tf)`가 `limit`·`sinceMs`를 준다. 인덱스 커버링 쿼리 1회(≈5ms).
캐시 히트에도 발생하는데, 캐시 키에 이력 지문이 들어가므로 키 계산에 이미 필요하다.
측정 후 부담되면 Redis에 지문만 짧은 TTL로 캐싱.

### 5-4. 모델 스코프

**결정 확정(2026-09-02).** `model_id`는 저장하되 **읽을 때 필터하지 않는다**.
모델별로 자르면 데이터가 6분의 1로 희박해져 대부분 빈 이력이 된다. 과거 시장 판단은 어느 모델이 냈든 시장 판단이다.
뒤집는 건 WHERE 한 줄.

프롬프트 각 줄에 모델명은 표기하지 않는다 — 모델이 "저건 다른 모델이니 무시"하는
행동을 유도할 이유가 없다.

---

## 6. siglens-trader 변경 (v0.28.5 기준)

### 6-A. 새 테이블을 만들지 않는다 — `analysis_results`가 이미 이력 테이블이다

실측 확인:

- **append-only** — 코드 전체에 `analysis_results` DELETE/cleanup/retention 0건
- 인덱스 `idx_analysis_symbol_type_date (symbol, analysis_type, analyzed_at)`
- `analysis_type` 5축(technical/news/options/fundamental/congress) = siglens의 `tab`
- `app_version` = 프롬프트 세대 마커 — 내 `prompt_version`과 같은 의도
- 프롬프트 원문 미저장 — §7과 같은 판단이 스키마 주석에 이미 적혀 있다
- `analyzed_at`이 저장 시각이 아니라 원본 분석 시각 → 봉 앵커와 정합

두 번째 테이블을 만들면 분석 1건당 write가 2회가 되고 감사 추적이 두 곳으로
갈라진다. 필요한 건 **컬럼 하나**다(§6-1).

### 6-B. 다만 확인된 부채 2건

**(1) 리텐션이 없다.** `analysis_results`는 무한히 자란다. 이 기능이 만든 문제는
아니지만, 이력 읽기가 이 인덱스에 의존하게 되므로 지금 넣는 게 맞다. siglens와
같은 기준(30일)으로.

**(2) `getLatestAnalysisResult(symbol, type)`이 execute 크론의 신선도 게이트다.**
`api/cron/execute.ts`가 5축 전부를 이 쿼리로 읽어 `source_analyzed_at` 나이를
잰다. `timeframe` 컬럼을 추가한 뒤 이 쿼리를 timeframe으로 **필터할지**는 별도
결정이다 — 필터하면 더 정확하지만 operator가 `analysis_timeframe`을 바꾼 직후
전 종목이 "이력 없음"이 되어 청산 평가가 멈춘다. **1차에서는 필터하지 않는다**
(현행 동작 유지). 조용히 바꾸지 말 것.

### 6-0. 선결: core pin 올리기 ⚠️

trader는 `@y0ngha/siglens-core` **0.50.2**, siglens는 **0.54.0**. trader가
`priorAnalyses`를 쓰려면 신규 릴리스로 올려야 하고, 그 과정에서 0.51~0.54의
**로케일·통화 계약 변경**이 함께 딸려온다. trader는 화면 로케일 개념이 없으므로
`locale`은 기본값(`DEFAULT_ANALYSIS_LOCALE`)에 맡기되, **캐시 키가 바뀌는지**만
확인한다(trader는 `force=true`라 실질 영향 없음). 이게 trader 쪽 최대 리스크이고
이력 기능과 무관하게 발생하는 비용이다.

### 6-1. `timeframe` 컬럼 추가 — 필수

현재 없다. 타임프레임은 `config` 테이블의 **전역 값** `analysis_timeframe`이고
`/api/config`로 런타임 변경된다(15Min/30Min/1Hour, `confluence_htf`보다 낮아야
한다는 교차 검증까지 있음). 즉 operator가 값을 바꾸는 순간 이력이 조용히 섞이고,
봉 앵커가 **1Hour 분석을 15Min 봉에 대고 재게 된다**. 기존 행은
`'1Hour'`(`DEFAULT_ANALYSIS_TIMEFRAME`)로 백필.
`idx_analysis_symbol_type_date` → `(symbol, analysis_type, timeframe, analyzed_at desc)`.

`saveAnalysisResult()` 인자에 `timeframe` 추가 — `appVersion`처럼 내부에서
붙이지 말 것. 호출부가 실제로 타임프레임을 알고 있고, 기본값을 두면 축 하나가
빠져도 컴파일이 통과한다.

### 6-2. 읽기 쿼리

`getRecentAnalysisResults(db, { symbol, type, timeframe, limit, since })`.

### 6-2a. 프롬프트 컬럼 (§7과 동일)

`analysis_prompt_blobs` 테이블 + `analysis_results`에 3컬럼 추가.
`saveAnalysisResult()`가 블롭 upsert 후 해시를 기록한다.
trader는 단일 로케일·단일 모델·워치리스트 규모라 siglens보다 볼륨이 훨씬 작다.

### 6-3. 주입 — technical 단독

`lib/analysis/run-technical.ts`에서 `runAnalysis` 옵션에 `priorAnalyses` 추가.
나머지 네 축(news/options/fundamental/congress)은 1차 범위 밖 — 봉 앵커가
성립하지 않는다(§4-4a). 축약 변환은 `lib/analysis/`에 두고 `lib/strategy/`
(순수 계층)는 건드리지 않는다.

### trader 특이점

- `force=true`라 **캐시 키 문제 없음**(§4-5 무관)
- `analyzed_at`이 저장 시각이 아니라 원본 분석 시각이라 봉 앵커와 정합
- 이력이 매매 게이트에 새 입력을 주지 않는다 — `trade-gate.ts` 불변
- 로케일 다중화가 없어 봉당 1행 → §3-2 접기가 사실상 no-op

---

## 7. 프롬프트 원문 저장

**저장한다**(2026-09-02 결정). 다만 통째로 넣지 않는다 — `AssembledPrompt`는
`{ stable, dynamic }` 쌍이고 두 조각의 성격이 정반대다.

- `stable` — `always_on` 스킬 다이제스트만. **호출 간 바이트 동일**이 core의
  명시적 계약이다(같은 `(analysisType, catalog)`이면 동일, 캐시 프리픽스로 쓰라고
  그렇게 설계됨). 현재 `always_on` 스킬은 24개 / 원본 199KB이고, technical 컨텍스트
  화이트리스트를 통과한 부분집합의 다이제스트가 여기 들어간다.
- `dynamic` — 나머지 전부(심볼·봉 데이터·지표·게이트된 스킬·이력). 호출마다 다름.

행마다 `stable`을 복사하면 **가장 큰 덩어리를 상수로 중복 저장**하게 된다.
그래서 내용 주소화 블롭 테이블 하나를 둔다.

```ts
export const analysisPromptBlobs = pgTable('analysis_prompt_blobs', {
    hash: char('hash', { length: 64 }).primaryKey(),   // sha256(body)
    body: text('body').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
        .notNull().defaultNow(),
});
```

`analysis_history`에 붙는 컬럼:

```ts
promptStableHash: char('prompt_stable_hash', { length: 64 }),  // → blobs
promptSystemHash: char('prompt_system_hash', { length: 64 }),  // → blobs
promptDynamic: text('prompt_dynamic'),                          // 호출별. TOAST가 압축
```

- 쓰기: `INSERT … ON CONFLICT (hash) DO NOTHING` 후 해시만 기록. FK는 걸지 않는다
  (블롭 정리와 이력 정리 주기가 다르다 — §7-1).
- `prompt_dynamic`은 `text`. Postgres TOAST가 큰 값을 자동 압축하므로 별도
  압축 코드는 넣지 않는다.
- 셋 다 nullable. 저장 실패가 분석을 막으면 안 된다 — write는 `after()`에서
  best-effort, 실패 시 이력 행은 남고 프롬프트 컬럼만 NULL.

### 7-1. 리텐션이 두 개다

| 대상 | 보존 | 이유 |
|---|---|---|
| `result` (분석 결과) | **90일** | 1Day 이력이 21 **거래일**을 봐야 한다 — 달력으로 약 30일이라 30일 보존은 경계에 걸린다 |
| `prompt_dynamic` | **7일** | 디버깅·eval 용도라 최근성이 전부. 7일 지나면 컬럼만 `NULL`로 비우고 행은 남긴다 |
| `analysis_prompt_blobs` | 참조 0인 것만 | 상수라 몇 개 안 쌓인다 |

이력 기능이 읽는 건 `result`뿐이므로 프롬프트를 비워도 기능에 영향 없다.

### 7-2. 용량은 배포 후 실측한다

행당 비용 = `prompt_dynamic` 압축 후 크기(대략 원본의 1/4~1/5).
`stable`·`system`은 전체에서 **각 1벌**.

지금 심볼 수·로케일 분포를 모른 채 숫자를 지어내지 않는다. 7일 리텐션이
상한을 잡아 주므로, 1주 뒤
`pg_total_relation_size('analysis_history')`로 재고 필요하면 리텐션을 줄인다.

### 7-3. `input_fingerprint` / `prompt_version`은 그대로 둔다

프롬프트 원문이 7일 뒤 사라져도 **어느 세대·어느 입력이었는지**는 남아야 한다.
trader가 `app_version`으로 같은 판단을 이미 해뒀다.

---

## 8. 검증

| 대상 | 방법 |
|---|---|
| 봉 앵커 컷 | core 단위 테스트 — 21봉 밖 제외, 주말 갭에서 봉 기준으로 세는지 |
| 짧은 bars 방어 | `bars.length < 21`이면 `bars[0]` 앵커로 전체 허용 |
| 봉 중복 접기 | 한 봉에 4로케일 4행 → 1건, 타이브레이크 결정론적 |
| 로케일 프리 | `en`·`ko` 두 호출의 이력 지문이 동일한지 |
| 캐시 키 안정성 | 현재 TTL 창 안에 이력 1건 추가 → 키 불변. 창 넘기면 키 변경 |
| 하위 호환 | `priorAnalyses` 생략 시 프롬프트 바이트 동일 + 키 세그먼트 부재 |
| 결과 계산 | 봉 배열보다 오래된 이력 → outcome 생략하되 이력 자체는 포함 |
| 프롬프트 블롭 중복 제거 | 같은 catalog로 2회 호출 → `analysis_prompt_blobs` 행이 1개 |
| 프롬프트 write 실패 격리 | 블롭 upsert 실패 시 이력 행은 남고 프롬프트 컬럼만 NULL |
| 리텐션 2종 | 7일 초과 행의 `prompt_dynamic`은 NULL, `result`는 90일까지 생존 |
| **앵커링 회귀** | trader `analysis_results` 전후 비교 — 연속 분석의 `trend` 전환 빈도가 급감하면 앵커링. 가드레일 강화 |

마지막 줄이 가장 중요하다. trader가 `analysis_results` + `trades` + 실현손익을
갖고 있어 **효과를 실제로 측정할 수 있는 유일한 곳**이다.

---

## 9. 순서 — 3개 동시 진행

core는 하드 의존이지만 **DB 작업은 core를 기다릴 필요가 없다**.

```
[병렬 착수]
  A. core    — PriorAnalysis 타입, 봉 앵커, 봉 접기, 결과 계산,
               technical·overall 프롬프트 섹션, 가드레일 상수,
               analysisHistoryQuery, 캐시 키 축, p8→p9
  B. siglens — analysis_prompt_blobs + analysis_history 마이그레이션,
               SSE 라우트 write(after()), 리텐션 2종
  C. trader  — core pin 0.50.2 → 최신, timeframe 컬럼 + 백필 + 인덱스,
               프롬프트 블롭 테이블 + 3컬럼, 리텐션, 읽기 쿼리

[A 릴리스 후]
  B2. siglens — read + priorAnalyses 주입 (technical·overall 2축)
  C2. trader  — run-technical.ts 주입
```

B·C는 core 없이 완결되고 그 자체로 무해하다 — 테이블에 쓰기만 하고 아무도 안 읽는다.
**B·C를 먼저 배포할수록 좋다**: siglens는 이력이 0에서 시작하므로(§5-2a) 쓰기가
빨리 켜질수록 A 릴리스 시점에 참조할 이력이 쌓여 있다.

관측은 trader에서 먼저 나온다(§8 마지막 줄). 앵커링 신호가 보이면
`HISTORY_SLACK`이 아니라 **가드레일 문구**부터 손본다.

---

## 10. 원 요구 대비 도달도

| 원 요구 | 상태 | 비고 |
|---|---|---|
| 분석 결과 JSON을 DB에 저장 | ✅ | siglens 신규 테이블 / trader 기존 테이블 |
| 프롬프트 원문 저장 | ✅ | §7 — stable 중복 제거, 7일 보존 |
| 응답 저장 | ✅ | `result`가 곧 파싱된 응답 |
| 최근 7건을 타임프레임별로 주입 | ✅ | 봉 앵커 21봉 |
| 이력 없으면 현행대로 | ✅ | 바이트 동일 프롬프트 |
| 모델마다 따로 저장 | ✅ | `model_id` 컬럼 |
| 모델마다 따로 참조 | ⚠️ **의도적 미적용** | 읽기는 모델 무시(§5-4). WHERE 한 줄로 전환 가능 |
| 짧은 봉에서 옛 데이터 차단 | ✅ | 5Min 105분 / 1Day 21거래일 |
| 일관성 향상 | 🟡 미측정 | 메커니즘 성립. 앵커링이 반대 방향 리스크 |

범위: technical + overall (siglens) / technical (trader). 나머지 축은 2차.

### 측정 정의

- **앵커링(나쁜 방향)**: 연속 분석 간 `trend` 전환 빈도. 급감하면 이력이
  판단을 굳히고 있는 것 → 가드레일 문구부터 손본다
- **일관성(좋은 방향)**: 같은 심볼 연속 분석의 `keyLevels` 지지/저항 값 분산.
  시장이 안 변했는데 레벨이 튀던 것이 줄면 성공
- trader에서만 추가로: 이력 ON/OFF 기간의 실현손익 비교

---

## 11. 참고 — 최근 siglens 변경 중 이 설계에 닿는 것 (2026-09-02 확인)

- **사후 번역 계층 제거됨.** 8축 전부 core에 `locale`을 넘겨 대상 언어로 직접
  생성한다. `analysis-translation`에 남은 건 `extractProse`뿐이고 이름은 잔재다.
  → §3-3의 "로케일마다 별도 LLM 실행" 전제는 **맞다**.
- **`entities/analysis-plain` 신설**(2026-08-31). 생성된 분석을 평이한 산문으로
  다시 쓰는 후처리 레이어이고, **프롬프트 빌더가 siglens에 있다**
  (`lib/buildPlainPrompt.ts`). "프롬프트는 전부 core"라는 전제는 이미 깨져 있다.
  이력 다이제스트가 숫자·enum만 쓰므로 plain 레이어와 충돌하지 않는다.
- **`visitor_days` / `content_translations`** 신설 — 이 설계와 무관.
- core 레포는 릴리스와 동기(v0.54.0 = HEAD, 미배포 커밋 없음).
- trader는 v0.28.5에서 정지. core pin 0.50.2로 4버전 뒤처짐(§6-0).
- 스펙 문서 위치: `docs/superpowers/specs/`.
