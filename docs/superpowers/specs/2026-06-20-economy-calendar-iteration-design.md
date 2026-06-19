# 경제 캘린더 후속 이터레이션 설계 (2026-06-20)

PR #610(월 그리드 캘린더 + KST, `EconomicCalendarGrid`)이 머지된 상태에서 이어가는 후속
이터레이션. 4개 sub-project로 분해하며, 공유 데이터 모델 위에서 독립적으로 구현 가능하다.

## 목표 (사용자 pain → 해결)

1. **과거 이벤트 표시** — 현재 미래 window만 보여 어제 발표된 지표를 선택할 수 없다. 최소
   지난 2주 + 발표치(actual)까지 표시.
2. **지표명 한국어화** — FMP 이벤트명이 영어("Core PCE Price Index YoY (May)")라 가독성이 낮다.
3. **중요도 필터** — High/Medium/Low 필터로 노이즈(연간 Low 2,919건) 정리.
4. **이벤트 AI 분석(Medium+)** — bullish/bearish·해석·요약.

## 실측 데이터 (FMP `/stable/economic-calendar`, `from`/`to` 지원)

- 1년 단일 요청 OK: 전체 29,225건 / **US 4,601건** / 355일 (범위 캡 없음).
- 정규화(끝 괄호 `(May)`/`(Q1)` 제거) **distinct 지표명 = ~277개** (raw 3,123은 기간 변형 포함).
- impact 분포(연간): **High 324 · Medium 1,350 · Low 2,919** → Medium+ = 1,674/년(~140/월).

## Cross-repo 경계 (CLAUDE.md guard)

| 작업 | 레포 |
|---|---|
| FMP 백필/ingestion I/O, DB 스키마/저장, 필터 UI, 지표명 코드 사전, 표시, AI 잡/캐시/어댑터 | **siglens** |
| 이벤트 **AI 분석 로직/프롬프트**(sentiment·해석·요약), 미매핑 지표명 **AI 번역** | **siglens-core** |

core 변경은 사용자가 publish(`npm version` + `git push --tags`). siglens는 core 릴리스 후 버전 갱신·import.

---

## 공유 데이터 모델 (siglens, `src/shared/db/schema.ts`)

기존 `marketNews`(발표 후 채워지는 필드 + AI 필드 + analyzedAt)와 `earningsReports`(actual 후채움),
`assetTranslations`(번역 테이블) 패턴을 미러링한다.

### `economic_calendar`

```
id            text PK         -- 결정론적 해시(country + dateEt + event), upsert 키
country       text NOT NULL   -- 'US' (현재 US만 저장)
dateEt        text NOT NULL   -- FMP 원본 'YYYY-MM-DD HH:mm:ss' (ET 벽시계). KST 변환은 표시 계층(etDateTimeToKst)
event         text NOT NULL   -- FMP 원본 이벤트명(영어)
impact        text NOT NULL   -- 'High' | 'Medium' | 'Low'
estimate      double NULL
previous      double NULL
actual        double NULL     -- 발표 전 null, ingestion 재fetch 시 채워짐
unit          text NOT NULL
fetchedAt     timestamptz NOT NULL DEFAULT now()
-- SP-D에서 별도 마이그레이션으로 추가(SP-A 테이블에는 미포함):
--   sentiment text NULL ('bullish'|'neutral'|'bearish'), summaryKo text NULL,
--   interpretationKo text NULL, analyzedAt timestamptz NULL
index: (dateEt), (country, dateEt), (impact)
```

`id` 해시는 `actual`을 포함하지 않는다 — actual이 발표 후 바뀌어도 같은 이벤트로 upsert해 갱신한다.
(이는 #610 그리드의 React key `${date}:${event}:${actual}`와 의도가 다름에 주의: DB는 안정 키.)

### `economic_indicator_translations` (SP-B)

`assetTranslations` 미러.

```
normalizedName text PK   -- 정규화된 지표 base명(접미사 제거), 예 'Core PCE Price Index YoY'
koreanName     text NOT NULL
source         text NOT NULL  -- 'dict' | 'ai'
updatedAt      timestamptz NOT NULL DEFAULT now() $onUpdate
```

코드 const 맵이 source-of-truth(`dict`), 미매핑은 core AI 번역 결과를 여기에 `ai`로 캐시한다.

---

## SP-A — 이력 데이터 레이어 (기반, siglens)

다른 SP 전부의 전제. 캘린더 데이터를 Redis 스냅샷에서 분리해 DB-backed로 전환한다.

### 컴포넌트
- **`scripts/backfillEconomicCalendar.ts`** — 사용자가 **1회 수동 실행**. now±1년(~2년)을 청크(예 월별/3개월별)로 FMP fetch → `economic_calendar` upsert. 재실행 안전(idempotent upsert). 동시에 SP-B 사전 시드용으로 distinct 정규화 이름 집합을 추출/덤프.
- **`entities/economy/actions/ensureEconomicCalendarAction.ts`** — `ensureMarketNewsCardsAnalyzedAction` 미러. **±1개월 윈도우** FMP fetch → upsert(신규 insert + 기존 `actual`/estimate/previous update). fire-and-forget, 에러는 로깅만.
- **`entities/economy/api/`** — `getCalendarFromDb(fromEt, toEt)`: DB에서 과거2주+미래window 읽기. ISR cold-gen 안전(`staticSymbolCache`/unstable_cache 래핑, 4축 규약 준수).
- **economy 페이지**: 캘린더 데이터 소스를 `economySnapshotCache`(Redis)에서 **`getCalendarFromDb`**로 교체. 지표/treasury 스냅샷은 그대로. `EconomicCalendarGrid`에 과거+미래 이벤트를 함께 전달. **기본 선택일 = 오늘(KST)**, 오늘 이벤트가
없으면 가장 가까운 미래일 — 결정론적(렌더 중 `Date.now()` 금지 위배 주의: 페이지 RSC에서 ET 기준
오늘을 1회 계산해 prop으로 전달, 그리드는 그 값을 받아 사용).
- **on-access 트리거**: 클라 위젯이 마운트 시 `ensureEconomicCalendarAction` 1회 호출(news `useMarketNewsAnalysisTrigger` 패턴). 봇 포함(봇 접속 시도 갱신).

### 데이터 흐름
페이지 ISR 렌더 → DB read(과거2주+미래) → 그리드. 클라 마운트 → ensure(±1mo fetch+upsert) → revalidateTag로 다음 렌더 신선화(news `revalidateTag('news:..','max')` 미러).

### 에러 처리
FMP 실패 시 DB의 기존 데이터로 graceful(빈 배열 아님). upsert 충돌은 id PK로 흡수.

### 테스트
backfill 스크립트(청크 분할·idempotent upsert·이름 추출), ensure 액션(insert/actual-update 분기), getCalendarFromDb(범위·정렬), ISR 안전(connection 금지). vitest + 기존 economy 테스트 스타일.

---

## SP-B — 지표명 한국어화 (siglens i18n + core AI 번역)

### 컴포넌트
- **`entities/economy/lib/indicatorNameKo.ts`** — `INDICATOR_NAME_KO: Record<string, string>` 코드 const(~277, source-of-truth). + **정규화 함수** `normalizeIndicatorName(raw)`: 끝 괄호(`(May)`/`(Q1)`/`(Jun/20)`) 분리, base명 + 기간 토큰 반환. + 기간 토큰 한국어화(YoY→전년比, MoM→전월比, QoQ→전분기比, 월/분기명).
- **표시 헬퍼** `indicatorLabelKo(raw)`: 정규화 → 코드 사전 룩업 → DB 캐시 룩업 → 미매핑이면 원문(영어) + (백그라운드) AI 번역 트리거. "매핑되면 즉시, 안 되면 AI 1회 후 캐시"(news 번역 결).
- **`economic_indicator_translations` DB 캐시** — core AI 번역 결과 저장(`source:'ai'`), 추후 코드 사전 승격.
- **core**: `translateIndicatorName(normalizedName): Promise<string>` (또는 배치) — 분석 계열이므로 core. siglens 어댑터가 호출 + 캐시.
- **초기 277 사전 구축**: SP-A 백필 enumeration → 정규화 distinct 추출 → core AI로 초벌 번역 → 사용자/내가 큐레이션 → `indicatorNameKo.ts` 고정(1회 데이터 작업).

### 데이터 흐름
표시 시 raw명 → normalize → dict(코드) hit이면 즉시 / miss이면 DB(`ai`) hit이면 즉시 / 둘 다 miss이면 영어 표시 + ensure식 백그라운드 AI 번역 → DB 캐시 → 다음 렌더 한국어.

### 테스트
normalize(접미사 분리·기간 토큰), dict 룩업, DB 캐시 fallback, 미매핑 영어 유지. core 번역은 core 테스트.

---

## SP-C — 중요도 필터 UI (siglens, 작고 독립)

### 컴포넌트
- **`EconomicCalendarGrid`** 상단에 영향도 필터 칩(High/Medium/Low 토글). 클라 상태(useState). **기본값: High+Medium 켜고 Low 끔**(연간 Low 2,919 노이즈 정리). 전체 이벤트는 DOM 유지(SSR 크롤), 필터는 시각적(셀 점/건수·상세 목록을 선택 impact로 한정).
- 접근성: 토글 버튼 `aria-pressed`, 그룹 `role="group" aria-label="중요도 필터"`. SSR 크롤러는 필터 무관 전체 텍스트 봄(hidden 아님, 시각 필터).

### 의존
#610 캘린더만 필요. SP-A 없이도 미래 window에 적용 가능(단 과거 데이터는 SP-A 후 풍부).

### 테스트
기본 필터 상태, 토글 시 표시 변화, 전체 이벤트 DOM 유지(크롤). vitest.

---

## SP-D — 이벤트 AI 분석 (Medium+) (core 분석 + siglens 잡)

### core (siglens-core)
- **`analyzeEconomicEvent(input): EconomicEventAnalysis`** — 입력: event명·impact·actual/estimate/previous·unit(+필요시 직전 추세). 출력 구조: `{ sentiment: 'bullish'|'neutral'|'bearish', summaryKo, interpretationKo }`. 프롬프트·정규화·검증 = core. PROMPT_TEMPLATE_VERSION 관리.

### siglens
- **DB**: `economic_calendar`의 sentiment/summaryKo/interpretationKo/analyzedAt 채움.
- **`ensureEconomicEventsAnalyzedAction`** — Medium+ & `actual !== null` & `analyzedAt === null`인 이벤트만 core 분석 호출 → DB 저장. **seed**: 백필 후 Medium+ 전량 1회 배치. **on-access**: /economy 마운트 시 미분석 발표분만(news 조건과 동일). 봇 포함.
- 비동기 비용 큰 경우 macroBriefing식 submit/poll(잡 큐) 미러. 쿨다운·재분석은 news/macro 패턴 따름.
- 표시: 상세 패널에 sentiment 배지(AA 토큰)·요약·해석. 미분석(미발표/Low)은 기존대로.

### 의존
SP-A(이벤트+actual DB) 필요. cross-repo: core 먼저 릴리스 → siglens 어댑터.

### 테스트
ensure 분기(Medium+/actual/analyzedAt 조건), DB 저장, 표시. core analyze는 core 테스트.

---

## 구현 순서

1. **SP-A**(기반: DB·백필·ensure·페이지 DB 전환) — 나머지 전제.
2. **SP-C**(필터: 작고 독립, 빠른 UX) — A와 병렬 가능.
3. **SP-B**(번역: A 백필로 사전 시드) — core 번역 + 코드 사전.
4. **SP-D**(AI 분석: A 필요, 최대·cross-repo) — core 릴리스 후.

각 SP는 자체 plan→구현. SP-D의 core 부분은 별도 core 작업(사용자 publish).

## 비용/성능 고려

- 매 접속 1년 fetch 금지(전송 비용) → 1회 백필 + ±1개월 ingestion.
- ISR(86400) 유지, 신선도는 ensure + revalidateTag(news 미러).
- AI 분석은 Medium+(~140/월)로 한정, seed 1회 + 미분석분만.
