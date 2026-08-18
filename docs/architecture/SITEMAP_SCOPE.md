# Sitemap 범위 — 무엇을 색인에 올릴지 정하는 규칙

이 문서는 "왜 sitemap에 종목이 이것뿐인가"에 답한다. 특히 **한국 종목 마스터에는
2,595종목이 시드돼 있는데 sitemap에는 20종목만 실려 있다** — 그건 미완성이 아니라 결정이다.

## 1. 결정: 시드된 전 종목을 sitemap에 넣지 않는다

**대상**: `korean_tickers`에 시드된 KOSPI·KOSDAQ 2,595종목(2026-08 기준).
**결정**: sitemap에는 큐레이션된 20종목만 싣는다. 나머지는 색인 대상이 아니다
(`evaluateSymbolIndexability`가 화이트리스트 밖 심볼을 longtail-default-blocked로 판정한다).

### 근거 — 이 저장소는 이미 한 번 해봤고 대가를 치렀다

2026-07에 노출이 절벽처럼 꺾였다. 원인은 두 가지가 겹친 것이었고, 그중 우리가 만든 쪽이
**thin 콘텐츠 대량 색인**이다. 그때의 대응이 지금 코드에 그대로 남아 있다:

- `sitemap-longtail-:page.xml`은 **410 Gone으로 은퇴**했다
  (`src/app/api/sitemap/longtail/[page]/route.ts`). 라우트를 지우지 않고 410을 반환하는
  이유는 이미 색인된 URL을 크롤러에게 명시적으로 회수시키기 위해서다.
- `sitemap-removal-:kind.xml` 계열이 신설됐다 — 색인에서 **빼기 위한** sitemap이다.
- sitemap index는 5개에서 3개(static/popular/crypto)로 줄었다.

2,595종목 × 6탭 = **15,570 URL**은 은퇴시킨 longtail sitemap보다 큰 규모다. 같은 실수를
이름만 바꿔 다시 하는 것이다.

### 근거 — 종목이 존재한다는 것과 페이지에 내용이 있다는 것은 다르다

큐레이션 20종목은 "yahoo가 시세를 준다"가 아니라 **차트·펀더멘털·재무가 모두 채워지는 것을
실측으로 확인한** 종목들이다(`popular-tickers.ts` KR 블록 주석). 코스닥 하위 종목은 상당수가
재무 데이터가 비거나 뉴스가 잡히지 않아, 페이지는 200으로 뜨지만 내용은 폴백 문구다.
색인에 올릴 가치가 있는 페이지와 렌더 가능한 페이지는 같은 집합이 아니다.

이 판단은 미국 주식·암호화폐에도 똑같이 적용돼 있다 — FMP는 수천 종목을 주지만
`POPULAR_TICKERS`와 `POPULAR_CRYPTOS`만 sitemap에 실린다. 한국 종목만 다르게 대할 이유가 없다.

## 2. 늘리려면 — 순서가 정해져 있다

큐레이션 목록은 고정이 아니다. 다만 **sitemap이 먼저가 아니라 마지막**이다.

1. **prewarm 유니버스에 넣는다** (`POPULAR_TICKERS`). 그래야 `seo_analysis_snapshots`에
   봇이 읽을 서술이 생긴다. 이게 실질 비용이다 — 심볼당 탭 5개의 LLM 생성이 매일 밤 돈다.
2. **용량을 확인한다.** 밤당 처리량은 대략 `틱 수 × SYMBOLS_PER_TICK`이고, 현재 유니버스
   대비 여유가 얼마인지는 `[seo-prewarm] batch done` 로그의 `staleTotal`/`remaining`으로
   본다. `remaining`이 매일 밤 0으로 수렴하지 않으면 이미 포화다 — 그 상태에서 심볼을
   더하면 기존 종목의 스냅샷이 낡는다.
3. **콘텐츠 깊이를 실측한다.** 봇이 받는 SSR 본문 길이를 잰다
   (`e2e/specs/kr-equity-seo.spec.ts`의 thin 콘텐츠 가드가 같은 측정을 자동화한다).
   2026-07 절벽 당시 봇이 받던 양이 677자였다. 그 근처면 넣지 않는다.
4. **그 다음에** `POPULAR_TICKERS`와 여섯 개 `kr-*` 카테고리 중 해당 업종
   (`kr-semiconductor` / `kr-auto-battery` / `kr-bio` / `kr-platform` / `kr-finance` /
   `kr-kosdaq`)에 함께 추가한다. 불변식은 **합집합**이다 — `kr-*` 카테고리 종목의
   합집합 = `POPULAR_TICKERS`의 KR 블록이고, 한 종목이 두 카테고리에 들어가면 안 된다
   (`popular-tickers.test.ts`가 둘 다 강제). 카테고리 그리드가 한국 종목으로 가는
   **유일한 크롤 가능한 링크**라, 여기 빠지면 sitemap에만 있는 고아가 된다.

   > 2026-08 이전에는 `korea-equity` 단일 카테고리였다. 업종 분할 후에도 검사 대상은
   > 개별 카테고리가 아니라 합집합이라는 점이 핵심이다 — 카테고리를 더 쪼개도 한 종목이
   > 어느 카드에도 안 들어가면 같은 고아가 생긴다.

## 3. 자동화한다면 — 게이트는 "종목 존재"가 아니라 "스냅샷 존재"여야 한다

목록을 손으로 관리하는 게 언젠가 부담이 되면, 자동화의 게이트는 반드시
**`seo_analysis_snapshots`에 fresh 행이 있는 심볼만 sitemap에 싣는다**여야 한다.
`korean_tickers` 멤버십을 게이트로 쓰면 그건 2,595종목을 넣는 것과 같다.

이 방향은 인과가 옳다: 유니버스(편집 결정 + LLM 예산)가 앞서고 sitemap이 따라온다.
반대로 하면 sitemap이 먼저 커지고 콘텐츠가 못 따라가면서 정확히 2026-07이 재현된다.

## 4. 상장폐지

`korean_tickers.delisted_at`이 상장 상태를 들고 있고, 일 1회 크론(`docs/reference/CRON.md`
`kr-tickers`)이 갱신한다. 검색은 상장 중인 행만 본다.

**`POPULAR_TICKERS`는 하드코딩이라 자동으로 빠지지 않는다.** 그 목록의 종목이 폐지되면
크론이 `[kr-tickers] delisted popular ticker — remove from POPULAR_TICKERS: …`를 error로
남긴다. 사람이 목록에서 빼기 전까지 sitemap은 그 URL을 계속 싣고, 크롤 예산이 404로 샌다.

## 5. lastmod

`buildPopularEntries`가 종목이 상장된 거래소의 마지막 마감을 `lastmod`로 쓴다 —
국내 종목은 KRX(15:30 KST), 나머지는 NYSE(16:00 ET, 반장은 13:00). 계산은
`shared/lib/marketSessionDate.ts`가 전담하며 주말·DST·NYSE 휴장일을 모두 처리한다.

`MarketProfileDescriptor.sitemapLastmod`라는 필드가 한때 이 등급을 선언했지만 읽는 곳이
없었다(2026-08 제거). 심볼→프로필 판정이 어차피 호출부에 필요해서 그 필드를 배선해도
분기가 줄지 않았고, 선언만 있고 강제되지 않는 설정은 조용히 실제 동작과 어긋난다.
