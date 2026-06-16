# ISR Revalidate 정책

> 동적 세그먼트 ISR 페이지의 `revalidate` 값을 페이지 성격별로 정하는 기준과 근거.
> 값을 바꾸기 전에 이 문서를 먼저 읽고, 바꾼 뒤에는 이 표를 함께 갱신한다.
> 관련: [`src/app/CLAUDE.md`](../../src/app/CLAUDE.md) (ISR 4축 규약·리터럴 강제),
> [`PERFORMANCE_BASELINE.md`](./PERFORMANCE_BASELINE.md), [`../reference/CRON.md`](../reference/CRON.md).

## 0. 한 줄 요약

ISR `revalidate`는 **"크롤러가 보는 SSR HTML을 이만큼 묵혀도 되는가 + Fast Origin Transfer/ISR 비용"** 기준으로 정한다.
**사용자 신선도는 ISR이 아니라 클라이언트 refetch가 100% 책임지므로**, revalidate를 길게 잡아도 사용자 경험은 그대로다.

## 1. 설계를 지배하는 3가지 사실

1. **사용자 신선도 = 클라 refetch.** 모든 `[symbol]/*`·`/market` 페이지는 진입 후 `useBars`(staleTime 30s)·
   `useAnalysis`(마운트 시 트리거)·폴링으로 최신 데이터를 다시 받는다. ISR HTML은 첫 페인트 + **크롤러가 JS 없이
   읽는 SEO 콘텐츠**일 뿐이다. → revalidate를 늘려도 사용자는 손해가 없고, 묵는 건 크롤러가 보는 데이터뿐.

2. **revalidate가 줄이는 비용은 Fast Origin Transfer / ISR read·write 유닛이다 (Fast Data Transfer 아님).**
   - **Fast Data Transfer**(CDN↔사용자)는 캐시 HIT이어도 바이트가 나가므로 revalidate와 무관하다 — 그건
     Cloudflare 앞단 캐시율(별도 과제)의 몫.
   - revalidate를 길게 잡으면 백그라운드 재생성(함수 호출)이 줄어 **Fast Origin Transfer**와 **ISR read 유닛**이
     준다. ISR write는 "내용이 직전과 같으면 0"이라 추가 이득.

3. **`[symbol]/*`는 종목별 페이지(수천 개)다.** on-demand ISR(`generateStaticParams=[]`)이라 접근된 종목만
   캐시되고, cron으로 전 종목 `revalidateTag`를 도는 건 **Fast Origin Transfer를 폭증**시켜 비용 목표와 자기모순이다.
   → 종목 페이지는 **revalidate 시간 + 이벤트 기반 on-demand**만 쓰고, 시간 기반 cron은 도입하지 않는다.

## 2. 페이지별 revalidate

| 페이지 | revalidate | 근거 |
|---|---|---|
| `/` (홈) | **86400 (24h)** | skills 파일(디스크)은 배포 시에만 변함 — 장중 신선도 개념이 없음 |
| `/[symbol]` (차트) | **21600 (6h)** | SSR에 지표 요약이 박히나 천천히 변하고, 사용자는 클라 `useBars`(30s)가 최신화 |
| `/[symbol]/overall` | **43200 (12h)** | AI 종합 분석은 느리게 변하고 클라가 마운트 시 재요청 |
| `/[symbol]/fundamental` | **86400 (24h)** | FMP 재무는 분기(약 45일) 단위 |
| `/[symbol]/financials` | **86400 (24h)** | 재무제표는 분기성 데이터; AI 분석은 클라 폴링으로 신선도 보장 — fundamental과 동일 근거 |
| `/[symbol]/congress` | **86400 (24h)** | 공시지연 약 45일 — 의원 거래 공시 주기가 분기성; financials와 동일 근거 |
| `/[symbol]/news` | **43200 (12h)** | 신선도는 on-demand 무효화(§3)가 보장 — 시간 기반은 상한선일 뿐 |
| `/[symbol]/fear-greed` | **86400 (24h)** | SSR은 정적 가이드뿐(점수는 클라가 bars로 계산) |
| `/[symbol]/options` | **43200 (12h)** | SSR은 만기일뿐(Max Pain/IV/OI는 클라) |
| `/market` | **3600 (1h)** | **단일 페이지**라 재생성 비용이 작고, 장중 섹터 신호 신선도를 위해 짧게 유지 |
| `/[symbol]/{og,twitter}-image` | 2592000 (30d) | (ticker, label) 순수 함수 — 템플릿 변경은 배포가 무효화 |

> 트래픽 대부분인 종목 페이지를 6~24h로 늘려 백그라운드 재생성(Fast Origin Transfer)을 줄이고,
> 비용이 미미한 단일 페이지(`/market`)만 1h로 둬 크롤러 신선도를 챙기는 구조.

## 3. On-demand 무효화 (news)

`/[symbol]/news`는 시간 기반 외에 **이벤트 기반 무효화**가 신선도를 책임진다:

- 사용자가 뉴스 페이지에 진입하면 클라 훅(`useNewsAnalysisTrigger`)이 `ensureNewsCardsAnalyzedAction(symbol)`을
  호출 → 소스에서 fresh 뉴스 fetch → DB upsert.
- **새 기사가 실제로 있을 때만**(`fresh.length > 0`) 그 직후 `revalidateTag('news:${SYMBOL}', 'max')`로 해당 종목의
  news ISR 캐시만 무효화한다 (`src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts`).
- 즉 "보는 종목 + 새 기사 있을 때만" 갱신하는 트래픽 기반 self-갱신이라, 시간 기반 revalidate를 길게(12h) 잡아도
  실질 신선도가 유지된다.

`staticSymbolCache`의 `news:${symbol}` 그룹 태그가 이 선택적 무효화를 가능하게 한다 (bars/peek/profile 캐시는 보존).

## 4. Cron을 도입하지 않은 이유

장중에 모든 페이지를 최신화하고 싶더라도, **시간 기반 cron은 도입하지 않는다**:

- 사용자 신선도는 이미 클라 refetch가 보장한다 (§1-1). cron이 추가로 바꾸는 건 크롤러 SSR + 첫 페인트뿐이다.
- 종목 페이지 전수 cron은 안 보는 롱테일 종목까지 재생성해 Fast Origin Transfer를 폭증시킨다 (§1-3).
- cron이 값을 하는 유일한 곳은 단일 페이지(`/market`)인데, 그건 revalidate 1h로 충분히 커버된다.

신선도가 민감한 데이터는 cron이 아니라 **데이터 변경 이벤트 직후 `revalidateTag`**(§3)로 처리한다.

## 5. 값을 바꿀 때 주의

- **반드시 정적 리터럴.** `export const revalidate = 21600` 처럼 생짜 숫자 + `// 6h` 인라인 주석. 상수 import나
  표현식(`60 * 60`)은 Next 정적 분석을 깨 config가 조용히 무시되고 ISR이 깨진다 (`src/app/CLAUDE.md` 참조).
  이 때문에 `docs/workflows/MISTAKES.md` §15(매직넘버 상수 추출)은 route segment config에 적용하지 않는다.
- `●`(SSG) 빌드 표시는 런타임 보장이 아니다. prod build + start 후 `x-nextjs-cache` HIT와 `DYNAMIC_SERVER_USAGE` 0을
  실측한다.
- 값을 바꾸면 §2 표를 함께 갱신한다.
