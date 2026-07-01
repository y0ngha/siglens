# EOD 일봉 캐시 재설계 — 검증 테스트케이스

- 작성일: 2026-07-01
- 대상 변경: `perf/eod-cache-redesign` (worktree `/Users/y0ngha/Project/siglens-eod-redesign`)
- 관련 스펙: `docs/superpowers/specs/2026-07-01-eod-cache-redesign-design.md`
- 성격: **백엔드 캐싱 내부 변경** — 사용자 화면 출력은 이전과 **완전히 동일**해야 함
- 검증 방식: prod-like 로컬 실행(`yarn build` → `yarn start`) + curl + Chrome

---

## 1. 스코프 & 불변 항목 (must stay identical)

이 변경은 `CachedMarketDataProvider.getCachedDailyBars`(1Day 일봉 전용)의 **캐시 키 구조와
staleness 판정만** 바꾼다. 반환하는 `Bar[]` 집합은 단일 `getBars(from)`와 동일해야 하며,
그로부터 파생되는 **모든 사용자 화면 출력이 변경 전과 픽셀/숫자 단위로 동일**해야 한다.

### 변경 전과 동일해야 하는 것 (관측 대상)

`/[symbol]` 차트 페이지에서 일봉(1Day)으로부터 파생되는 렌더:

| 항목 | 출처(컴포넌트/함수) | 관측 방법 |
|---|---|---|
| 차트 일봉 캔들 (1일 timeframe) | `StockChart` (bars) | Chrome: `1일` 캔들 시리즈 렌더 |
| 현재가 + 등락률 | `TechnicalFactsSummary` → `현재가`, `$`, `±x.xx%` | curl(문자열) + Chrome |
| 52주 위치 (고저 대비) | `buildTechnicalFacts.high52w/low52w` → `52주 위치` | curl(문자열) + Chrome (값 타당성) |
| RSI / MACD 모멘텀 | `buildTechnicalFacts` (동일 bars 기반 indicators) | Chrome |
| MA 오버레이(MA200 포함) | 차트 `MA` overlay (`indicatorRegistry` key `ma`) | Chrome: MA 라인 + 범례 |
| 표본 봉 수(~1년 ≈ 252 거래일) | `TRADING_DAYS_52W = 252` 슬라이스 = merge 정확성 | Chrome: 52주 값이 full 히스토리 기반으로 타당 |

> 주의: `MA200`·`표본 N봉`은 화면에 리터럴 문자열로 노출되지 않는다(오버레이 라인/차트
> 범위로 표현). 따라서 이 둘은 **차트 오버레이 렌더 + 52주 값 타당성**으로 간접 검증한다.
> full ~1년 히스토리(history tier)와 최근 tail(recent tier)이 올바르게 merge·slice되면
> 52주 고저와 MA 라인이 정확히 그려진다.

### 내부적으로 바뀐 것 (curl로 직접 관측 불가 — 배포 후 FMP 대시보드로 확인)

- 캐시 키에서 rolling 날짜 제거: `bars:eodhist:<SYM>` (immutable history) + `bars:eodrecent:<SYM>` (live tail)
- history staleness는 TTL이 아니라 recent 겹침(`getOrSetCache` 신규 `isFresh` 인자)이 주도
- 기대 효과: `historical-price-eod/full` **호출수·egress 감소**(자정 키롤·반복 크롤 재fetch 제거)
- **이 효과는 로컬 curl로 볼 수 없다.** 배포 후 FMP 대시보드에서 `historical-price-eod/full`
  calls/egress를 배포 전(325 calls / 9.75 MB) 대비 확인한다.

---

## 2. 환경 (prod-like from worktree)

```bash
# 1) 환경파일 복사 (메인 워킹트리 → 이 워크트리). gitignore라 git status에 안 보임.
cp /Users/y0ngha/Project/siglens/.env.local      /Users/y0ngha/Project/siglens-eod-redesign/.env.local
cp /Users/y0ngha/Project/siglens/.env.production /Users/y0ngha/Project/siglens-eod-redesign/.env.production

# 2) prod 빌드 (exit code 직접 캡처 — 파이프 금지)
cd /Users/y0ngha/Project/siglens-eod-redesign
yarn build > /tmp/eod-build.log 2>&1; echo "BUILD_EXIT=$?"
# → BUILD_EXIT=0 이어야 진행

# 3) prod 서버 기동 (포트 4310 — 기존 4200/4310 충돌 회피)
yarn start -p 4310
```

### 전제 / 주의

- **Redis(Upstash)는 옵션.** 미설정/장애 시 `getOrSetCache`가 graceful fallback으로 inner를
  직접 호출하므로 페이지는 정상 렌더된다(캐시 절감 효과만 없음). `.env`에 Upstash 키가 있으면
  실제 2-tier 캐시 경로가 동작한다 — 캐시 warm/cold 케이스(Method A 2차 요청)를 보려면 필요.
- 환경파일은 **세션 종료 후 복원 불필요**(복사본). 단, 메인 워크트리 것과 키셋이 다르면 빌드타임
  ISR 페이지(`/economy`·`/market` 등)가 degraded일 수 있으나 **본 검증 대상(`/[symbol]`)과 무관**.
- FMP/외부 API 키 필요: `/[symbol]`의 일봉·현재가는 FMP에서 fetch된다.

---

## 3. Method A — curl (6 케이스)

각 케이스: `HTTP 200`, 일봉 파생 마커 문자열 present, `500` 없음.
검증 마커(SSR 텍스트, `TechnicalFactsSummary`): `기술적 지표 요약`, `현재가`, `52주 위치`, `$`.

```bash
BASE=http://localhost:4310
check() {
  local sym="$1"
  local body; body=$(curl -s -o /tmp/eod-$sym.html -w "%{http_code}" "$BASE/$sym")
  echo "=== $sym : HTTP $body ==="
  grep -o "기술적 지표 요약" /tmp/eod-$sym.html | head -1
  grep -o "52주 위치"       /tmp/eod-$sym.html | head -1
  grep -o "현재가"          /tmp/eod-$sym.html | head -1
  grep -oE '\$[0-9,]+\.[0-9]+' /tmp/eod-$sym.html | head -1   # 현재가 $ 포맷
  grep -c "Internal Server Error\|500" /tmp/eod-$sym.html      # 0 이어야 함
}
```

| # | 케이스 | 명령 | 기대 |
|---|---|---|---|
| A1 | AAPL (US equity) | `check AAPL` | 200, `기술적 지표 요약`·`52주 위치`·`현재가`·`$xxx.xx` present, 500=0 |
| A2 | MSFT (US equity) | `check MSFT` | 동일 |
| A3 | NVDA (US equity) | `check NVDA` | 동일 |
| A4 | BTCUSD (crypto) | `check BTCUSD` | 200, 파생 마커 present. crypto는 세션 24/7 → recent tail 상시 60s(정상). `$` 포맷은 crypto 자릿수 규칙 |
| A5 | AAPL 재요청 (cache warm) | `check AAPL` (2회차) | 200, A1과 **동일** 마커·현재가. Redis 있으면 캐시 hit 경로, 없으면 fallback — 어느 쪽이든 결과 동일 |
| A6 | MSFT 재요청 (cache warm) | `check MSFT` (2회차) | 200, A2와 동일 |

**PASS 조건:** 6/6 HTTP 200, 각 케이스에서 일봉 파생 마커 문자열 present, `$` 현재가 매칭,
500/Internal Server Error 카운트 0, 그리고 A5/A6 재요청이 1차 요청과 일관(현재가·52주 값 동일).

---

## 4. Method B — Chrome (4 케이스)

`http://localhost:4310/<SYM>` 로 이동해 육안 + 콘솔로 확인.

| # | 케이스 | 확인 항목 |
|---|---|---|
| B1 | `/AAPL` 차트 렌더 | ① 차트가 **`1일` timeframe 일봉 캔들**로 렌더됨 ② `기술적 지표 요약` 패널의 `현재가`가 라이브 값(`$`)으로 표시 ③ `52주 위치`(고점 대비 −x.x%, 저점 대비 +x.x%) 값이 **타당**(고점 대비 ≤ 0, 저점 대비 ≥ 0) ④ MA 오버레이(MA200 포함) 라인 + 범례 렌더 ⑤ **콘솔 에러 0** |
| B2 | `/MSFT` 차트 렌더 | B1과 동일 5항목 |
| B3 | `/AAPL` merge 정확성 | 차트 x축이 **약 1년(~252 거래일) full 히스토리**를 커버 — 최근 봉이 오늘/직전 거래일까지 이어지고(recent tail merge), 과거로 ~1년 연속(history tier). 갭/중복 캔들 없음(mergeBarsByTime dedup + sliceFrom) |
| B4 | `/AAPL` 라이브 현재가 | 페이지 로드 후 현재가가 라이브(useBars 30s refetch)로 유지·갱신. 장중이면 forming 봉/현재가가 quote 기반으로 최신 |

**타당성 근거:** 52주 고저·MA200은 history + recent가 올바르게 병합·슬라이스되어야만 정확히
그려진다. history만/​recent만으로는 ~1년 범위가 안 나온다 → merge 정확성의 시각 증거.

**콘솔 확인:** DevTools Console에 uncaught error / hydration mismatch / failed fetch 없어야 함.

---

## 5. Pass/Fail 체크리스트

### 환경
- [ ] `.env.local`·`.env.production` 워크트리에 복사됨
- [ ] `yarn build` `BUILD_EXIT=0`
- [ ] `yarn start -p 4310` 정상 기동

### Method A (curl, 6)
- [ ] A1 AAPL — 200 + 마커 present + `$` + 500=0
- [ ] A2 MSFT — 200 + 마커 present + `$` + 500=0
- [ ] A3 NVDA — 200 + 마커 present + `$` + 500=0
- [ ] A4 BTCUSD — 200 + 마커 present + 500=0
- [ ] A5 AAPL 재요청 — 200 + A1과 일관(현재가·52주 동일)
- [ ] A6 MSFT 재요청 — 200 + A2와 일관

### Method B (Chrome, 4)
- [ ] B1 `/AAPL` — 1일 일봉 캔들 / 현재가 `$` / 52주 타당 / MA 오버레이 / 콘솔 에러 0
- [ ] B2 `/MSFT` — 위 5항목
- [ ] B3 `/AAPL` — ~1년 full 히스토리 커버, 갭·중복 없음 (merge 정확성)
- [ ] B4 `/AAPL` — 라이브 현재가 유지·갱신

### 불변성 (핵심 판정)
- [ ] 일봉 파생 렌더(캔들·현재가·52주·MA·RSI/MACD)가 **변경 전과 동일**
- [ ] UI/메타데이터 변경 **없음** (순수 캐싱 내부 변경)

### 배포 후 (로컬 검증 불가 — 별도)
- [ ] FMP 대시보드에서 `historical-price-eod/full` calls/egress가 배포 전(325 / 9.75 MB) 대비 감소
- [ ] 자정(UTC) 전후 스파이크 소멸 확인

---

## 부록 — 결과 기록 템플릿

```
빌드: BUILD_EXIT=___
A1 AAPL   HTTP___ 마커___ $___ 500=___
A2 MSFT   HTTP___ 마커___ $___ 500=___
A3 NVDA   HTTP___ 마커___ $___ 500=___
A4 BTCUSD HTTP___ 마커___ 500=___
A5 AAPL#2 HTTP___ 일관___
A6 MSFT#2 HTTP___ 일관___
B1 AAPL   캔들__ 현재가__ 52주__ MA__ 콘솔__
B2 MSFT   캔들__ 현재가__ 52주__ MA__ 콘솔__
B3 AAPL   ~1년범위__ 갭/중복없음__
B4 AAPL   라이브현재가__
판정: PASS / FAIL
```
