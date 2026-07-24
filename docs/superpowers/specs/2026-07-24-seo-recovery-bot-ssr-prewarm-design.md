# SEO 회복 — 봇 SSR 콘텐츠 실질화 + 분석 스냅샷 Pre-warm 설계

> 작성 2026-07-24 (v3). 승인된 통합 스펙 — 스냅샷 pre-warm(주 기능) + OG 이미지 크롤 차단 + degraded ISR 가드 + fear-greed SSR 강화.
> 검토 이력: Opus 4.8 적대적 검토 3회(설계안 1회 + 스펙 실코드 검증 2회) + 자체 검토 2회 반영 완료. 3차 검토에서 v2의 B1/B2/B3/G1-G4/R2 픽스 전부 SOUND 판정.
> v3 주요 반영: lib seam의 request-context 호이스팅 명세(NB-1), 스냅샷 read의 unstable_cache 필수화(NB-2 — ISR dynamic 회귀 방지), 락 라이프사이클 명세, core force 경로 확정(6/7탭), 워커 처리량 제약 하 "다일 수렴" 목표 정합화.

## 1. 배경과 문제

2026-06-30 Google June 코어 업데이트 개시와 함께 노출수가 절벽 급락(~800/일 → ~0)했다. 3개 시스템(GSC·AWS·Cloudflare) 전수 조사로 인프라 장애·크롤 차단·페널티·삭제 요청은 전부 배제됐고, 원인은 **프로그래매틱 심볼 페이지의 thin 콘텐츠**로 확정됐다:

- 7개 submit 액션 전부 `skipEnqueueIfMiss = isBot()` — **봇은 AI 분석 생성을 트리거하지 못한다.** 캐시가 cold면 봇은 영원히 placeholder만 본다.
- 실측: `/AAPL` 968KB HTML에 가시 텍스트 **677자**(0.07%). `/AAPL/overall`·`/NVDA/overall` 모두 "캐시되지 않았습니다" placeholder가 SSR로 서빙. 심볼 간 가시 텍스트 ~90%가 동일 템플릿.
- Googlebot 크롤 예산의 ~70%가 `/[symbol]/**/opengraph-image`·`twitter-image` PNG에 소모(61GB). "크롤링됨-미색인" 1.2만 건의 대부분이 OG 이미지 URL.
- `evaluateSymbolIndexability`의 `degraded → noindex` 분기가 ISR 캐시에 동결될 수 있다.
- 색인·sitemap 인프라는 완비: 전 탭이 index+sitemap 등재 상태이나 fear-greed 외엔 노출 기여 ~0. 콘텐츠만 실질화되면 재평가 준비 완료.

회복 시점 현실: 코어 업데이트 강등의 재평가는 통상 다음 코어 업데이트(Q3 예상)에 이뤄진다. **그 전에 본 스펙을 완성하는 것이 목표.**

## 2. 목표 / 비목표

**목표**
1. 화이트리스트 심볼(**실측: POPULAR_TICKERS 261 + POPULAR_CRYPTOS 29 = 290종**, `APPROVED_LONGTAIL_TICKERS`는 빈 배열)의 적용 가능한 AI 분석 탭 전부에 실질 SSR 텍스트를 노출하고 **일 단위 갱신으로 수렴**시킨다. (fail-open 구조라 SSR 커버리지는 후퇴하지 않으며, 리터럴 "매일 전량 재생성"은 공유 워커 처리량 제약상 보장 대상이 아님 — §9)
2. 봇·사용자 동일 HTML(클로킹 제로) — 스냅샷은 **사용자 가시 섹션**으로 렌더한다.
3. Googlebot의 OG 이미지 크롤 낭비를 차단한다.
4. degraded→noindex ISR 동결을 매일 치유하고, 스냅샷 보유 심볼은 일시 degraded에도 index를 유지한다.
5. fear-greed 페이지(검색 수요 최상위)의 SSR을 서버 계산 factor 서술로 강화한다.

**비목표**
- 롱테일 재개방 — 본 스펙 안착 후 별도 진행. 전 구성요소는 화이트리스트를 single source로 읽어 개방 시 자동 확장.
- 사용자용 실시간 분석 UX 변경.
- ISR 캐시 태그 스토어 외부화 — 후속 과제(§11).
- siglens-core 변경 — 불필요 검증됨(`skipEnqueueIfMiss`는 siglens가 core에 넘기는 파라미터).

## 3. 확정 요구사항 (사용자 승인)

| 항목 | 결정 |
|---|---|
| SSR 범위 | AI 분석 탭 전부 (technical/overall/fundamental/financials/congress/news/options — 자산군별 적용성 §5) |
| 신선도 | 일 1회, 미장 마감(16:00 ET) 후 |
| UX | "최근 분석 요약(전일 장마감 기준)" 가시 섹션 상시 노출 |
| 스펙 범위 | 통합(스냅샷+OG차단+degraded가드+fear-greed) — PR은 자연 분리 |
| 아키텍처 | B안: DB last-known-good 스냅샷 스토어 |
| cron 위치 | AWS (EventBridge Rule → API Destination). GitHub Actions 미사용 |
| isBot 게이트 | 현행 유지 — 봇은 생성 트리거 안 함 |
| 생성 조건 | tier=free + reasoning=off (익명 방문자와 동일) |
| FMP | 업그레이드 없이 300콜/분 내 운용 (§8) |

## 4. 아키텍처

```
[EventBridge Rule (UTC 고정)] ← infra/aws/13-seo-prewarm.sh (신규)
   │  cron(0/5 20-23 * * ? *) + cron(0/5 0-3 * * ? *) UTC — 매일 5분 간격 (8h 창, 96틱)
   │  API Destination: PATCH https://siglens.io/api/cron/seo-prewarm
   │  (Connection: Authorization Bearer CRON_SECRET, SSM 주입)
   ▼
[app/api/cron/seo-prewarm/route.ts]  (신규, app 레이어 오케스트레이션)
   │  ⚡ 인증 + Redis 루트 락 확인 후 즉시 202 응답 → 배치는 after()로 백그라운드 실행
   │  (EventBridge API Destination ~5s 타임아웃 + ALB idle 60s 회피)
   │  신선도 술어 게이트 → 심볼 배치 → 심볼별 순서 실행(§7)
   │  → 수확분 스냅샷 upsert → 심볼 완료 시 revalidatePath
   ▼
[entities/seo-snapshot]  (신규 슬라이스: 테이블 + repository만. 타 entity import 금지)
   ▲
[각 심볼 탭 페이지 RSC]  — "최근 분석 요약" 가시 섹션이 스냅샷 read → 한국어 산문 렌더
```

**시스템 콜러 seam (v2 개정 — 공개 파라미터 금지)**: ~~submit 액션에 `forceEnqueue` 파라미터 추가~~는 기각한다. server action은 공개 호출 가능 엔드포인트이고 분석 submit 경로에는 서버측 레이트리밋이 없어(재분석 쿨다운은 클라이언트 상태뿐), 공개 파라미터는 "무인증 FMP+워커 예산 소진" 공격면이 된다. 대신:

- 각 submit 액션의 본문을 **server-only lib 함수로 추출** (예: `entities/analysis/lib/submitAnalysisCore.ts`, `'use server'` 없음 — barrel 미노출, cron 라우트가 deep import).
- **⚠️ request-context 호이스팅 필수 (3차 검토 NB-1)**: 현행 액션 본문에는 `getCurrentUser()`·`headers()`·`isBot()`·`cookies()` 호출이 인라인돼 있다. 이를 **본문째 추출하면 안 된다** — cron/`after()` 경로에서 EventBridge UA로 isBot이 판정되는 등 오동작한다. lib 함수 시그니처는 **이미 해석된 값**을 받는다: `(userId=null, tier='free', skipEnqueueIfMiss, reasoning=false, force?)`. lib 내부에는 request-context 호출이 **0건**이어야 하며, public 액션(thin wrapper)이 이를 계산해 넘긴다.
- public 액션은 기존 시그니처 그대로(UA 기반 `isBot` 게이트 유지 — 기존 동작 무변경).
- cron 라우트는 lib을 `skipEnqueueIfMiss: false`로 직접 호출. 라우트 자체가 `CRON_SECRET`으로 인증(timingSafeEqual — `cleanupExpiredSessionsAction`의 인증 패턴만 차용. ⚠️ 해당 액션은 어디에도 배선 안 된 휴면 코드로, EventBridge 딜리버리 선례는 아님 — §11 딜리버리 스파이크).

**FSD 배치**: 7개 액션(entities/analysis·news-article·options-chain)의 조합 오케스트레이션은 app 레이어 cron 라우트 담당(app→entities 정방향). `entities/seo-snapshot`은 테이블+repository만 소유, shared만 import.

## 5. 데이터 모델

drizzle 컨벤션 준수: `src/shared/db/schema.ts`에 `pgTable`로 정의(**uuid PK `defaultRandom()`** — 기존 테이블 패턴) 후 `drizzle-kit generate`. 손 SQL 금지.

```ts
// schema.ts 개요 (실제는 pgTable 정의)
seo_analysis_snapshots {
  id           uuid PK defaultRandom()
  symbol       varchar NOT NULL      // 대문자 정규화
  tab          varchar NOT NULL      // 'technical'|'overall'|'fundamental'|'financials'|'congress'|'news'|'options'
  content      jsonb   NOT NULL      // core 정규화 타입드 분석 결과 (탭별 스키마 상이 — §7)
  model        varchar NOT NULL      // DEEPSEEK_V4_FLASH_MODEL 고정
  generatedAt  timestamptz NOT NULL  // 분석 실제 생성 시각 (§6 신선도 판정 — cron 수확 시각 아님)
  updatedAt    timestamptz NOT NULL
  UNIQUE(symbol, tab)                // last-known-good 1행 upsert
}
```

- **타입드 JSON 저장**: 렌더러가 산문 변환 — 문구 개선을 배포만으로 소급 적용.
- **팽창 없음**: ~1.8천 행. retention 불필요.
- **in-flight 가드**: Upstash Redis `seo-prewarm:inflight:{symbol}:{tab}` (TTL 30분) — 워커 지연 시 중복 enqueue 방지.
- **⚠️ 스냅샷 read는 `unstable_cache` 필수 (3차 검토 NB-2)**: `generateMetadata`의 `hasSnapshot`과 페이지 본문의 스냅샷 콘텐츠 read는 반드시 심볼 스코프 태그(`seo-snapshot:{symbol}`)의 `unstable_cache`로 감싼다. 비캐시 DB read가 정적 경로에 들어가면 `DYNAMIC_SERVER_USAGE`로 `[symbol]` ISR이 dynamic으로 회귀한다(ISR cold-gen 500 인시던트와 동일 계열 — app/CLAUDE.md 4축 규칙). pre-warm은 심볼 완료 시 `revalidateTag('seo-snapshot:{symbol}')`를 `revalidatePath`와 함께 호출한다.

**적용성 매트릭스** — 코드 상수. 신선도 술어가 사전 필터:

| 자산군 | 적용 탭 |
|---|---|
| 주식(POPULAR_OPTIONS_TICKERS 260종) | 7탭 전부 |
| 주식(옵션 미상장) | options 제외 6탭 |
| 크립토(29종) | technical · overall · news 만 |

총 유닛 ≈ 260×7 + 1×6 + 29×3 = **1,913유닛/일**.

## 6. Cron 흐름

**스케줄**: 클래식 EventBridge Rule은 UTC 전용, EventBridge Scheduler는 API Destination 타겟 불가 — **UTC 고정 룰 + 라우트 자체 게이트**. 창 20:00~03:59 UTC(~8h, 96틱)는 EDT/EST 양쪽 마감을 커버. 마감 전·이미 fresh면 no-op(무해). 주말·미국 휴장일엔 주식이 자동 fresh 판정(§신선도) → 크립토만 처리.

**응답 패턴 (v2, 3차 검토서 동작 검증됨)**: 인증·락 확인 후 **즉시 202 반환**, 배치는 Next `after()`로 백그라운드 실행 — self-hosted EC2 노드 서버라 서버리스 타임아웃 없음, `after()` 내 `revalidatePath`/`revalidateTag` 동작 확인됨. EventBridge API Destination 타임아웃(~5s)과 ALB idle 60s를 회피.

**락 라이프사이클 (v3)**: Redis 루트 락 **TTL 15분(최대 배치 시간 상회)** + 배치 종료 시 **명시적 해제**. 락 보유 중 invocation은 **2xx(204) 반환**(4xx/5xx 금지 — EventBridge 재시도 폭풍 방지). 인접 틱(+5분)은 락에 걸려 no-op, 해제 직후 틱부터 재개.

**신선도 엔진 (v2 명세)**:
- "최근 완료된 ET 정규장 마감" 시각은 **siglens가 직접 계산**한다 — core `getEtSessionStatus`는 open/closed/weekend 상태만 반환하고 마감 타임스탬프를 주지 않는다. 계산: 현재 ET 기준 가장 최근의 평일 16:00 ET (+**정착 버퍼 30분** — EOD 데이터 확정 대기, EDT 첫 유효 틱 ≈ 20:30 UTC).
- **미국 휴장일 캘린더는 도입하지 않는다**: 휴장일에 마감 경계를 잘못 산정해도 결과는 "전 거래일과 동일 데이터로 1회 재생성 또는 캐시 HIT 수확" — 무해한 낭비로 명시적 허용.
- 크립토는 동일 일일 앵커 사용.
- **탭별 캐시 만료 비균일 대응 (v3 확정)**: technical·overall은 core가 KST 05시 앵커로 만료(=마감 직후 만료, 항상 신선 생성)되지만, fundamental·financials·news·options·congress는 **write 시점 기준 평탄 24h TTL**이라 submit이 <24h 캐시를 반환할 수 있다. 수확 시 **콘텐츠의 자체 생성 시각이 최근 마감 이후일 때만 `generatedAt` 갱신**, 이전이면 **core `force` 파라미터로 재생성**한다 — 3차 검토에서 `force` 존재 확정: `submitAnalysis`(positional)·fundamental·financials·congress·options 옵션 객체에 있음. **유일한 예외 news는 `force` 없음** — 뉴스는 자연 일일 갱신이므로 콘텐츠 자체 시각을 정직 저장으로 갈음.

**용량 모델 (v2 재산정 — 2-pass 기준)**:
- 심볼당 방문 2회 필요(submit 패스 + 수확 패스). 필요 방문 ≈ 290×2 = **580회/일**.
- **10심볼/틱** × 96틱 = 960 방문 용량 ≥ 580 (여유 1.65×). ⚠️ EST(겨울)엔 마감 21:00 UTC+버퍼 30분 → 유효 틱 ~78개(780 방문, 여유 1.34×)로 줄지만 여전히 충족.
- 심볼 내 실행 순서: bars→fundamental→financials→congress→(news·options)→**overall 마지막**(scorecard·bars Redis HIT).
- 틱 내 **심볼 동시성 3** — core fundamental이 내부 `Promise.all`로 13콜을 병렬 발사하므로 순간 동시 FMP ≈ 3×13 ≈ 40콜로 캡(§8).

**라우트 로직 요약**: 인증(timingSafeEqual) → 락 → 202 → after(): 술어 통과 유닛 중 10심볼 선정 → 심볼 동시성 3으로 순서 실행 → `cached`(신선) 수확→upsert / `submitted`→in-flight 마커 → 심볼 완료 시 전 라우트 `revalidatePath` → 카운트 로깅 `{submitted, harvested, revalidated, remaining, fmpBudgetUsed}`.

## 7. 렌더링 / SEO

- **가시 섹션 `RecentAnalysisSummary`**: 각 탭 페이지 RSC가 스냅샷 read → "최근 분석 요약 (전일 장마감 기준)" 렌더. 스냅샷 없으면 현행 placeholder fallback.
- **렌더러 스코프 (v2 정직화)**: SSR facts 섹션이 이미 있는 탭은 **technical·overall 2개뿐**(news는 뉴스 목록 기반 별개). **fundamental·financials·congress·options 4탭은 SSR 섹션 신규 구현**이며, 7탭의 타입드 스키마가 전부 다르다 — 특히 overall은 `summary` 필드가 없고 `headlineKo`·`integratedConclusionKo`·`*BulletsKo[]` 구조. 탭별 렌더러 7종 각각에 **비공백 가시 텍스트 단언 테스트 필수**.
- **snapshot-first, peek fallback + 캐시 키 5축 고정 (v2)**: 기존 peek 경로는 fallback으로 유지하되, 스냅샷 생성과 peek이 **같은 캐시 엔트리를 가리키도록 5축 전부 고정**: `model=DEEPSEEK_V4_FLASH_MODEL`, `tier='free'`(fingerprint), `reasoning=false`, `positionBucket=undefined`, skill-catalog fingerprint(코어 버전 종속 — 불일치 시 peek만 miss, 스냅샷은 무영향).
- **free-tier 산문 검증**: technical은 free 필터가 `summary` 유지 실증(`FREE_INFO_DEPTH`). 나머지 탭은 구현 시 탭별 free 필터 통과 후 산문 잔존 검증.
- **news 탭 추가 강화**: 스냅샷 외 DB 뉴스 목록(제목·요약) SSR 노출 — 유일한 "매일 자연 갱신 유니크 텍스트" 소스.
- **fear-greed 강화 (AI 불필요)**: 서버 계산 factor 수치·점수 서술 SSR — pre-warm 무관, 렌더 타임 계산.
- **유니크 meta description**: 탭별 적합 필드에서 도출(technical=summary, overall=headlineKo 등). 스냅샷 없으면 현행 템플릿 유지.
- **degraded 가드**: `SymbolIndexabilityInput`에 `hasSnapshot: boolean` 추가. `degraded && whitelisted && hasSnapshot → indexable`. **metadata와 페이지 본문 양쪽** 모두 스냅샷 렌더(본문 degraded 분기에서도 섹션 유지). 스냅샷 없으면 기존대로 noindex.
- **OG 이미지 크롤 차단**: robots.ts `Googlebot` 전용 그룹 — baseline(`allow /`, `disallow /api/`) 복제 + `/*/opengraph-image`·`/*/twitter-image` disallow. Googlebot-Image는 Googlebot 그룹으로 폴백(별도 그룹 불필요). 패턴은 심볼 외 라우트(`/news/...`, `/share/[id]/...`)의 OG 이미지도 매칭 — 의도된 광범위 차단. ⚠️ 풋건: Googlebot 그룹 신설 후 `*`에만 추가되는 미래 룰은 Googlebot에 적용 안 됨 — **baseline 패리티 단언 테스트 필수**. 소셜 크롤러 무영향. 트레이드오프: Google Images 노출 상실(허용).
- 전 탭 `generateStaticParams []`(on-demand ISR) — 빌드타임 빈 테이블 문제 없음.

## 8. FMP 예산 (300콜/분 제한)

**제공자 맵**(실코드 추적): bars=FMP ~1콜/심볼(24h TTL·Upstash Redis 공유), fundamental=FMP **13**(내부 무제한 Promise.all — 코어 소관), financials=FMP ~6, congress=FMP 2, earnings ~1, quote(ISR 재생성) ~1 → **주식 심볼당 ~22 FMP 콜/일**. options=Yahoo, news=DB.

| 지표 | 수치 (v2) |
|---|---|
| 일일 상한(유기 중복 0 가정) | ~6,000 FMP 콜 (261주식×22 + 크립토 소량) |
| 틱당 | 10심볼 × 22 ≈ 220콜/5분 = **평균 ~44콜/분** |
| 순간 최악 버스트 | 심볼 동시성 3 × fundamental 13 ≈ **~40 동시 콜** (제한 대비 여유) |
| cron 창 유기 트래픽 | 최저 시간대 (20:00~03:59 UTC = KST 새벽 5~13시 중 전반부) |

**결론: FMP 플랜 업그레이드 불필요.** 구조적 가드:
1. **심볼 동시성 캡(3)** — 제출 단위 페이싱으로는 core 내부 13콜 병렬을 못 막으므로, 동시 처리 심볼 수 자체를 제한(순간 버스트 ~40콜 상한)
2. **Redis 루트 락** — invocation 중첩 차단
3. **429/402 대응**: `fmpRetry`는 429를 백오프+Retry-After로 재시도하지만 **402는 즉시 실패(비재시도) 실증** → Redis 일일 FMP 카운터로 예산 추적, 402 감지 시 당일 잔여 배치 즉시 중단(fail-open — 익일 재시도), CloudWatch 402/429 알람

## 9. 에러 처리

- **fail-open**: 생성 실패 시 이전 스냅샷 유지 — SSR 커버리지 절대 후퇴 없음.
- CloudWatch 알람 2종(07-alarms.sh 패턴): cron 연속 실패, FMP 402/429.
- 불가능 콤보는 매트릭스 사전 제외 — 무한 재시도 없음.
- **워커 백프레셔 (v3 — 구속 제약은 방문 용량이 아니라 워커 처리량)**: 필요 생성 ~1,913/일 vs 워커 ~4/분 = ~1,920/일 상한 — 여유 제로. 특히 technical·overall(주식 261×2=522+)은 KST 05시 앵커 만료라 **매일 강제 재생성분**. 따라서 목표는 "일 단위 갱신으로 수렴"(§2)이며 첫 사이클·워커 혼잡일은 다일 수렴 허용(fail-open이라 SSR 무회귀). 구현 중 워커 처리량 실측 후 심볼/틱·창 폭 조정.
- **revalidate 제약**: S3 cacheHandler 태그 스토어가 in-process Map — 즉시 반영은 **ASG desired=1에서만 보장**(현재 desired=1, max=4 스케일아웃 경로 존재). 스케일아웃 시 타 인스턴스는 ISR TTL(6~24h)로 지연 수렴 — 일 단위 SEO 신선도에는 허용. 태그 스토어 외부화는 후속 과제(§11).

## 10. 테스트

- **unit**: repository upsert/신선도 엔진(주말·휴장일·DST·정착 버퍼·탭별 TTL 수용 기준), 적용성 매트릭스, 탭별 산문 렌더러 7종(비공백 단언), `hasSnapshot` 게이트 분기(metadata+본문), robots 스냅샷(**Googlebot 그룹 baseline 패리티 단언 포함**), fear-greed factor 서술.
- **route**: CRON_SECRET 인증(timingSafeEqual·미설정 거부), 루트 락, 202+after 패턴, idempotency, 심볼/틱 상한, 마감 전 no-op, FMP 예산 중단, lib seam 스레딩(`skipEnqueueIfMiss:false`).
- **e2e**: 시드 스냅샷 행 → 탭 페이지 SSR 가시 텍스트 검증(외부 키 불필요 — E2E no-FMP 준수), 롱테일 noindex 불변, 스냅샷 없는 심볼 placeholder fallback.
- 커버리지 ~90%.

## 11. 운영 체크리스트 & 후속 과제

**배포 전** (⚠️ 12-isr-cache.sh 부트스트랩 인시던트 교훈 — 스크립트 선실행 + 컨테이너 printenv 검증):
- [ ] `CRON_SECRET`: `.env.example`·check-env에는 이미 등록됨 — **SSM 실값 주입만 필요**
- [ ] `infra/aws/13-seo-prewarm.sh` 실행 (Connection + API Destination + Rule 2개)
- [ ] drizzle 마이그레이션 적용 (`db:generate` 산출물)

**배포 후**:
- [ ] 첫 cron 사이클 카운트 로그 확인(`harvested` 수렴 추이) + FMP 402/429 알람 무발화
- [ ] `/AAPL` 가시 텍스트 증가 실측(현 677자 대비) + 스냅샷 섹션 렌더 확인
- [ ] GSC: 5/22 리터럴 `[SYMBOL]` 프리픽스 삭제 요청 취소
- [ ] ALB 액세스 로그 활성화(S3)
- [ ] CRON.md를 AWS 패턴으로 개정(현행 GitHub Actions/Vercel 기술은 stale)

**구현 중 검증 항목**:
- [ ] **EventBridge 딜리버리 스파이크 최우선** — Connection(Bearer 헤더)→API Destination→라우트 202 체인은 repo 최초 구축(선례 전무). 용량 모델 신뢰 전에 소규모 실검증
- [ ] 6개 탭(technical 외)의 free-tier 필터 산문 잔존
- [ ] `after()`+`revalidatePath`/`revalidateTag` prod-like 검증(3차 검토서 코드 레벨 동작 확인됨 — 실환경 확인만)
- [ ] 워커 처리량 실측(§9 백프레셔) 및 잡 결과 캐시 TTL ≥ 수확 지연(5~10분) 확인
- [ ] S3 cacheHandler의 revalidatePath 동작 prod-like 검증

**후속 과제(별도 이슈)**:
- ISR 캐시 태그 스토어 외부화(S3/DynamoDB) — ASG 스케일아웃 대비
- 롱테일 점진 재개방: 스냅샷 안착 후 `APPROVED_LONGTAIL_TICKERS`에 데이터 풍부 심볼부터 추가
- sitemap lastmod를 스냅샷 `generatedAt`으로

## 12. 회복 기대치

색인·sitemap 인프라는 완비 상태이므로 본 스펙은 "콘텐츠 실질" 조건을 채우는 작업이다. 코어 업데이트 강등의 재평가는 통상 다음 코어 업데이트(Q3 예상)에 이뤄진다 — 그 전 완성이 승부처이며, 즉각적 노출 회복을 보장하는 작업이 아님을 명시한다.
