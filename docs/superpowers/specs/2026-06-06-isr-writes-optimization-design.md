# ISR Writes 최적화 설계

> 작성 2026-06-06 · 영역 1/3 (Vercel 비용 절감 진단의 ISR Writes 파트)
> 관련: [`docs/architecture/ISR_REVALIDATE.md`](../../architecture/ISR_REVALIDATE.md), 진단 메모(On-Demand $109/사이클)

## 1. 배경

2026-06-06 Vercel Usage 실측에서 **ISR Writes 4.88M = $25.36/사이클**(비용 2위)이 확인됐다.
ISR write는 "재생성된 콘텐츠가 직전과 다를 때만" 과금되므로, 4.88M은 ISR 페이지가 **재생성마다 다른
HTML을 생산**한다는 뜻이다. Opus 에이전트 조사로 원인 3개를 규명했다:

1. **차트·fear-greed 페이지가 라이브 bar 가격을 SSR HTML에 박음** (최대 비중). bars Redis TTL이 장중
   60초라, 매 ISR 재생성 시 가격이 달라 write 발생. SSR 직렬화 경로 2곳:
   - `TechnicalFactsSummary`(가시 SSR HTML) — `lastClose`/`changePercent`/`rsi`/`macdHistogram`/52w
   - `dehydrate(queryClient)`로 React-Query state에 박히는 bars(OHLCV + `time`)
2. **news 무효화 빈도 폭풍**. `ensureNewsCardsAnalyzedAction`이 `fresh.length > 0`이면 방문마다
   `revalidateTag('news:${sym}', 'max')` 호출. `fresh`는 "lookback 내 소스 기사"라 **새 기사가 없어도**
   기존 기사가 포함되면 무효화 → 인기 종목이 1h보다 훨씬 자주 재생성.
3. **`/market`의 `computedAt` ISO timestamp가 SSR에 직렬화**. sector signals의 Redis TTL이 5~15분이라
   매 재생성마다 새 timestamp가 HTML에 박혀 write.

부수 효과: 매번 바뀌는 SSR 응답은 ETag도 매번 달라 **Cloudflare 캐시(현재 0.95%)도 무력화**한다.
따라서 이 작업은 ISR Writes와 CF 캐시율을 함께 개선한다.

## 2. 목표 / 비목표

**목표**
- 차트·fear-greed·`/market`의 ISR write를 "데이터가 실제로 의미 있게 바뀔 때"로 한정한다.
- 사용자 신선도(클라 라이브 데이터)와 SEO(크롤러용 fact layer)를 보존한다.

**비목표**
- 클라이언트 라이브 갱신 동작 변경 (사용자는 `useBars` 30s·라이브 그대로).
- siglens-core 분석 로직 변경 — 본 작업은 siglens의 SSR 직렬화·캐시 무효화·repository 레이어만 손댄다
  (스코프 가드 OK: I/O·캐싱·인프라는 siglens 책임).
- revalidate 값 변경 (이미 PR #572에서 차등화 완료).

## 3. 설계

### 3.1 가격 quantize — 일봉 종가 고정 (차트·fear-greed)

`DEFAULT_TIMEFRAME = '1Day'`(`src/shared/config/market.ts:11`)이므로 fact layer가 쓰는 bars는 이미 일봉이다.
**SSR 직렬화 경로에만** "마지막 *완료된* 일봉"까지 사용하도록 quantize한다 — 진행 중(forming) 당일 봉을 제외한다.

- 적용 지점:
  - `src/app/[symbol]/page.tsx` — `TechnicalFactsSummary`에 넘기는 `factBars`와 `dehydrate` seed bars
  - `src/app/[symbol]/fear-greed/page.tsx` — `dehydrate` seed bars
- **데이터 레이어(`getBarsStatic`)와 클라(`useBars`/`getBarsAction`)는 건드리지 않는다.** SSR seed만
  quantized → 클라 hydration이 라이브 bars로 덮어쓴다(사용자 경험 불변).
- "마지막 완료 일봉" 판정: 일봉은 ET 정규장 마감 후 확정되므로, 마지막 봉이 "오늘이고 장중(forming)"이면
  제외하고 직전 봉을 마지막으로 본다. 세션 판정은 core `isEtRegularSessionOpen`(이미 단일 source)을 활용한다.
  구체 판정 로직은 구현 계획에서 확정.
- 결과: SSR HTML이 **장 마감 시 하루 1회만** 변경 → write 60초 churn 제거. 크롤러는 "직전 일봉 종가 +
  그 시점 지표" fact를 본다.

### 3.2 news 무효화 게이팅 — upsert 실제 변경분

`upsertNewsItem`(현재 `src/entities/news-article/api.ts:29`, `Promise<void>`)이 **행이 실제로 신규 삽입/
내용 변경됐는지**를 반환하도록 바꾸고, `ensureNewsCardsAnalyzedAction`은 변경분이 1건 이상일 때만
`revalidateTag`를 호출한다.

- `upsertNewsItem(item): Promise<boolean>` (또는 `'inserted' | 'updated' | 'unchanged'`)로 시그니처 확장.
  Postgres `INSERT … ON CONFLICT … RETURNING`에서 신규 insert 여부를 판정(`xmax = 0` 트릭 또는
  값 비교). 구체 판정은 구현 계획에서 확정.
- `ensureNewsCardsAnalyzedAction`(`actions/ensureNewsCardsAnalyzedAction.ts:114-140`): `upsertSettled`에서
  "실제 변경된 건수"를 집계해 **`changedCount > 0`일 때만** `revalidateTag` 호출. 기존 `fresh.length === 0`
  early-return은 유지.
- 결과: "같은 기사 재fetch"는 무효화하지 않음 → 빈도 폭풍 제거. 진짜 새/변경 기사만 news 캐시 갱신.

### 3.3 computedAt strip (`/market`)

`/market`의 SSR seed payload에서 `computedAt`을 제거한다.

- `src/app/market/page.tsx` — `sectorData`를 `initialData`/`setQueryData`/`dehydrate`에 넣기 전 `computedAt`을
  제외(또는 ISR 윈도우로 quantize). `buildSectorFacts`는 `computedAt`을 사용하지 않으므로 SSR 텍스트에 영향 없음.
- 클라 refetch(`SectorSignalPanel`)가 실제 `computedAt`을 공급하므로 사용자 화면은 불변.
- 결과: 5~15분마다 바뀌던 timestamp churn 제거.

## 4. 트레이드오프

- **SEO (3.1)**: 크롤러가 SSR에서 보는 가격이 "라이브"에서 "직전 완료 일봉 종가"로 바뀐다. 가격·지표 fact
  자체는 유지되므로(axis-2 fact layer 보존) SEO 손실은 거의 없다. JS 실행 크롤러·사용자는 클라 hydration으로
  라이브를 본다.
- **news 신선도 (3.2)**: 게이팅이 과도하면 실제 변경을 놓칠 수 있으므로, 판정은 "내용 변경"까지 포함해
  보수적으로 한다(누락보다 약간의 과다 무효화가 안전).

## 5. 테스트 전략

- **3.1**: SSR fact bars가 forming 당일 봉을 제외하는지 단위 테스트. 동일 거래일 내 두 번 호출 시 동일
  출력(= write 없음) 검증. fear-greed dehydrate seed 동일.
- **3.2**: `upsertNewsItem`의 inserted/updated/unchanged 판정 테스트. `ensureNewsCardsAnalyzedAction`이
  `changedCount === 0`일 때 `revalidateTag`를 호출하지 않음(mock) 검증.
- **3.3**: `/market` SSR seed payload(`dehydrate`/`initialData`)에 `computedAt`이 없음을 검증.

## 6. 영향 파일

| 파일 | 변경 |
|---|---|
| `src/app/[symbol]/page.tsx` | factBars·dehydrate seed quantize |
| `src/app/[symbol]/fear-greed/page.tsx` | dehydrate seed quantize |
| (신규 util) bars quantize 헬퍼 | "마지막 완료 일봉" 산출 순수 함수 |
| `src/entities/news-article/api.ts` | `upsertNewsItem` 반환 확장 |
| `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts` | changedCount 게이팅 |
| `src/app/market/page.tsx` | computedAt strip |

## 7. 검증

- 단위 테스트(위) 통과 + `prod build && start` 후, 동일 거래일 내 차트/`/market` 재요청이 `x-nextjs-cache`
  HIT을 유지하고 ISR write 로그가 발생하지 않는지 실측.
- 다음 빌링 사이클의 ISR Writes 수치 감소로 최종 확인.
