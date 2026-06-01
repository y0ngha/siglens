# Vercel 트랜스퍼 비용 절감 설계 (Origin + Data Transfer)

- 작성일: 2026-06-01
- 상태: 설계 승인 대기
- 범위: siglens 앱 (인프라/캐싱). siglens-core 변경 없음.

## 1. 배경 / 문제

Vercel 비용 중 트랜스퍼 항목이 과도하게 발생. Observability "Fast Data Transfer" 라우트별 내역(최근 12h)에서 전 비용이 `/[symbol]/*`에 집중:

| Route | Requests | Transfer Out |
|---|---|---|
| `/[symbol]/options` | 11K | 1.39 GB |
| `/[symbol]/fundamental` | 8.6K | 730 MB |
| `/[symbol]/news` | 4.2K | 375 MB |
| `/[symbol]/options/opengraph-image` | 9K | 312 MB |
| `/[symbol]/fear-greed` · `/overall` · `/[symbol]` | 3~4K each | 245~283 MB |
| (기타 opengraph-image 들) | 1~1.8K | 37~59 MB |

진단:
- **Page Caching 0%** — 모든 요청이 compute에서 동적 SSR. 엣지 캐시 전무.
- **AhrefsBot 폭주** — 12h 동안 한 페이지(=`options/opengraph-image` 9K와 일치)에 9천+ 요청. AhrefsBot은 검색엔진이 아니라 SEO SaaS 크롤러로, 포털 랭킹에 기여 0.
- 사이트맵은 top 비용에 미등장(이미 `Cache-Control` 보유) → 대상 아님.

### 두 메트릭 구분 (Vercel 공식)

| 메트릭 | 정의 | 무료/단가(Pro) | 캐싱으로 줄어드나 |
|---|---|---|---|
| **Fast Origin Transfer** | CDN ↔ Functions ("CDN→Compute") | 100GB / $0.06/GB | **예** — ISR로 compute 호출이 재검증 시에만 발생 (단 Data Cache 자체도 origin transfer 일부 유발) |
| **Fast Data Transfer** | CDN ↔ 방문자 | 1TB / $0.15/GB | **아니오** — 응답 바이트는 캐시 hit이든 동일. 줄이려면 요청 수↓(봇 차단) 또는 payload↓ |

→ **봇 차단만이 두 메트릭을 동시에 절감**(요청 수 자체↓). ISR은 Origin Transfer를 절감.

## 2. 목표 / 비목표

목표:
1. 기생 봇(AhrefsBot 등) 트래픽 차단 → Origin + Data Transfer 동시 절감.
2. `/[symbol]/*` OG 이미지 + 페이지를 엣지 캐시(ISR/revalidate)해 compute 호출 절감.
3. **UX/SEO 무해(또는 유리)** 보장 — 특히 ISR로 인한 404 캐시 오염 방지.

비목표(이번 범위 제외):
- 서버액션 → GET 라우트 변환(POST는 CDN 캐시 불가, 지배적 비용도 아님).
- SSR 데이터 seed 제거를 통한 Data Transfer payload 경량화(D4=① 유지. Data Transfer가 측정 후에도 크면 후속 검토).
- `news` 페이지 ISR화(D2=① 동적 유지).
- Vercel WAF/Firewall 룰(robots.txt만 사용).

## 3. 결정 요약

| ID | 결정 |
|---|---|
| D1 | 봇 목록 = AhrefsBot + SemrushBot + MJ12bot + DotBot + BLEXBot + DataForSeoBot |
| D2 | `news` 페이지는 현행 동적 유지 (per-request `ensureNewsCardsAnalyzed` 부수효과 보존) |
| D3 | `getAssetInfo`가 인프라 에러는 throw, "no-match"만 null 반환 → ISR 404 캐시 오염 방지 |
| D4 | SSR 데이터 prefetch seed 현행 유지 (UX 보존) |
| D5 | revalidate: 페이지 1h(3600), OG 이미지 30d(2592000) |

## 4. 설계

### 4.1 봇 관리 — `src/app/robots.ts`

`rules`를 단일 객체 → 배열로 변경. 기존 `*` 규칙 유지 + 기생 봇 전면 Disallow.

```ts
rules: [
  { userAgent: '*', allow: '/', disallow: ['/api/'] },
  {
    userAgent: ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'DataForSeoBot'],
    disallow: '/',
  },
],
```

- 이 봇들은 robots.txt를 준수 → 다음 재확인 시(보통 하루 내) 크롤 중단.
- 검색엔진(Googlebot/Yeti/Bingbot/Daumoa)은 미포함 → SEO 영향 0.

### 4.2 OG 이미지 캐싱 — 12개 파일

대상: `src/app/[symbol]/{,fear-greed/,fundamental/,news/,options/,overall/}{opengraph-image,twitter-image}.tsx`

각 파일에 추가:
```ts
export const revalidate = 2592000; // 30d
```

- 이미지 내용은 `buildSymbolOgImage({ ticker, label })`로 `(ticker, label)`의 순수 함수 — fresh 데이터·`getAssetInfo` 호출 없음 → **404 위험 없음**, 길게 캐시 안전. 템플릿 변경은 배포 시 캐시 자동 무효화.
- 봇 차단으로 Ahrefs분은 소멸, 이 캐싱은 정상 크롤러/SNS(Google·Kakao·Naver·FB)의 반복 fetch를 엣지에서 처리.

### 4.3 페이지 ISR — `/[symbol]/*`

| 페이지 | 동적 트리거 | 변경 |
|---|---|---|
| `options`, `fundamental`, `fear-greed` | 없음 | `export const revalidate = 3600` 추가 |
| `page.tsx`(차트), `overall` | `searchParams(tf)` | **서버 tf 읽기 제거** + `revalidate = 3600` |
| `news` | `headers()` → `isBot` → `waitUntil` | 변경 없음(D2). 동적 유지 |

**tf 제거 안전성**: 클라이언트(`SymbolPageClient`)가 이미 `useSearchParams`로 timeframe을 직접 소유(L53/67). 서버는 `initialTimeframe`을 클라에 전달하지도 않음 → 서버 tf 읽기는 prefetch 키 선택에만 쓰임. 제거 시 SSR은 항상 `DEFAULT_TIMEFRAME` bars를 seed하고, `?tf=1W` 딥링크는 클라가 마운트 시 읽어 해당 tf를 fetch. canonical은 이미 tf 제외 → 색인 무영향.

**구현 주의**: 정적 렌더 라우트에서 client의 `useSearchParams()`는 `<Suspense>` 경계가 필요(없으면 빌드 에러/클라 deopt). 기존 경계 유지 확인 필요.

**`cacheComponents`와 무관**: 일반 ISR(`revalidate`)은 #439로 비활성된 `cacheComponents`(PPR/`use cache`)와 별개 기능. 막히지 않음.

### 4.4 D3 — 404 캐시 오염 방지 (핵심 안전장치)

**문제 (확정)**: `src/entities/ticker/lib/fmpTickerApi.ts`의 `fetchFmpEndpoint`가 모든 실패를 `return []`로 삼킴:
- `!config` → `[]`
- `!res.ok`(429/5xx) → `[]`
- `catch`(network/timeout) → `[]`

→ FMP 일시 장애 시 `searchBySymbol`이 `[]` → `getAssetInfo`가 `null` → 페이지 `notFound()` → **ISR이 정상 종목의 404를 revalidate 창(1h) 동안 캐시**(SEO 디인덱스 위험).

**해결 계약(invariant)**:
> `getAssetInfo`는 **인프라 실패 시 throw**, "조회가 정상 완료됐고 매칭이 없을 때만 `null`" 반환.

구현 방향:
1. **FMP fetch 경로**(getAssetInfo가 쓰는 `searchBySymbol`)가 인프라 실패를 **throw**하도록:
   - `!res.ok`(특히 429/5xx), network error/timeout, `!config`(미설정) → throw.
   - 200 응답인데 매칭 없음(빈 배열) → `[]` 정상 반환(legit no-match).
2. **인터랙티브 검색(search-as-you-type)의 graceful degradation은 유지**해야 함. `fetchFmpEndpoint`/`searchByName`은 검색 UI에서 에러 시 빈 결과로 degrade하는 동작이 의도된 것 → throw 동작은 getAssetInfo 경로에만 적용(예: `strict` 옵션 또는 전용 strict 함수 분리). 단일 공유 함수를 무조건 throw로 바꾸지 말 것.
3. `readFromDatabase`의 catch→null은 **유지 가능**(DB null은 FMP로 fall-through하며, FMP가 authoritative-or-throw이므로 false 404를 만들지 않음).

**결과**: 일시 인프라 장애 → 페이지 render throw → Next는 에러를 캐시하지 않음(다음 요청 재시도) → poisoned 404 없음. 진짜 없는 종목만 404 캐시(정상).

**부가 영향**: `options`/`fundamental`/`fear-greed`의 데이터 fetch 실패는 `notFound`이 아니라 빈/empty-state로 degrade(예: `OptionsEmptyState`) → 캐시되어도 self-healing, 디인덱스 위험 없음. 단 `getAssetInfo` null만이 404를 만들므로 D3로 충분.

## 5. 영향 파일

- `src/app/robots.ts` — 봇 규칙 배열화 (4.1)
- `src/app/[symbol]/**/{opengraph-image,twitter-image}.tsx` (12개) — `revalidate` 추가 (4.2)
- `src/app/[symbol]/page.tsx`, `src/app/[symbol]/overall/page.tsx` — 서버 `searchParams(tf)` 제거 + `revalidate` (4.3)
- `src/app/[symbol]/options/page.tsx`, `fundamental/page.tsx`, `fear-greed/page.tsx` — `revalidate` 추가 (4.3)
- `src/entities/ticker/lib/fmpTickerApi.ts` (및 필요 시 `getAssetInfo.ts`) — FMP 인프라 에러 throw 계약 (4.4)
- `src/app/[symbol]/news/page.tsx` — **변경 없음** (D2)

## 6. UX / SEO 안전성 (제약 충족 근거)

- **SEO**: 크롤러가 완전 렌더된 정적 HTML(메타데이터·JSON-LD·sr-only 콘텐츠 포함) 수신 → 유리. ISR로 페이지가 캐시되면 `htmlLimitedBots: /.*/`의 head-metadata도 캐시 HTML에 박힌 채 제공 → Naver/Kakao 미리보기 보존. tf-less canonical 유지 → 색인 변화 없음. **404 오염은 D3로 차단**.
- **UX**: 데이터는 클라가 재hydrate(D4 seed 유지 → 첫 페인트 데이터 보존). `?tf=` 딥링크 정상(클라 소유). 비기본 tf 딥링크만 첫 페인트에 기본 tf가 잠깐 보였다 교체 — 경미.
- **봇 차단**: 검색엔진 미포함 → 포털 SEO 영향 0.

## 7. 테스트

- `robots.ts`: 반환 규칙에 `*` allow + 기생봇 Disallow 배열 포함 검증 (단위).
- `fmpTickerApi`(D3): `!res.ok`/timeout/network/`!config` → throw, 200+빈배열 → `[]` 반환 검증. 인터랙티브 검색 경로는 여전히 degrade하는지 검증.
- `getAssetInfo`: FMP throw가 전파되는지(= null 아님), DB 실패는 FMP fall-through 후 정상 동작.
- ISR 페이지: 동적 트리거 제거 후 정적 생성 가능(빌드), `useSearchParams` Suspense 경계 유지.

## 8. 롤아웃 / 측정

- 단일 PR로 4.1~4.4 함께 머지. 배포는 사용자 담당(`chore: release`).
- 배포 후 24h Vercel Usage(Fast Origin + Fast Data Transfer)와 Page Caching 비율 변화 측정.
- 봇 차단이 robots 재확인까지 수일 걸릴 수 있음 → 즉시 0이 아님(자율 준수 특성). AhrefsBot 요청 수 추이로 확인.

## 9. 향후(측정 후 검토)

- Fast Data Transfer($0.15)가 여전히 크면 → D4②(SSR seed 제거로 HTML 경량화), 특히 `options`(옵션 체인 페이로드 큼).
- `news` ISR화(부수효과를 렌더 밖 client/cron으로 이전).
- 마운트마다 강제 재분석(`initialAnalysisFailed={true}`)·react-query `staleTime` 재검토로 클라 서버액션 호출 절감.
