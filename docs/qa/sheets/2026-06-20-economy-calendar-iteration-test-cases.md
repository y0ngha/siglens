# Economy Calendar Iteration — QA Test-Case Sheet (배포 전 실증)

> 대상: `/economy` 경제 캘린더 반복 작업 (SP-A ~ SP-D, `feat/economy-calendar-audit-fix`)
> 작성일: 2026-06-20
> 목적: **수동 실증 QA** (curl + Chrome). E2E/단위 테스트가 커버하더라도 prod-like 빌드/실행에서 동작·SEO를 두 트랙으로 검증한다.
> 가정: dev/prod 서버가 `http://localhost:4200`에서 기동. curl 예시의 `BASE`는 `http://localhost:4200`.

---

## 0. 실행 전 준비 (Preconditions — 모든 케이스 공통)

- prod-like 빌드: `yarn build > /tmp/build.log 2>&1; echo $?` 로 exit code 직접 캡처 (파이프 금지). exit 0 확인.
- 워크트리 `node_modules`는 symlink 금지 (`cp -al` 하드링크 또는 독립 `yarn install`). `siglens-core` 0.25.0 핀 일치 확인.
- `.env.local` / `.env.production` 키셋이 형제 워크트리와 일치 (QA env 스왑 복원 누락 주의).
- 서버 기동: `yarn build` → `yarn start`(prod 모드) 또는 `yarn dev`.
- **AI 분석 모드 주의**:
  - prod-like(`E2E_TEST` 미설정): AI 분석은 실제 LLM/worker 거침. 캘린더 sentiment는 DB에 저장된 기분석 값.
  - `E2E_TEST=1` 빌드: `FakeEconomyProvider` 사용. 캘린더는 시드된 데이터(감사 후속 e2e 시드)에서 읽힘.
- 환경 변수 참고: `NEXT_PUBLIC_SITE_URL` 미설정 시 SEO URL은 `https://siglens.io` 기본값 → 로컬 메타의 canonical/og:url은 `https://siglens.io/...`로 박힘(정상). 경로 구조만 검증한다.

### 참고 상수 (검증 기준값)

| 항목 | 값 |
|---|---|
| `revalidate` (page) | `86400` (24h) |
| `PAST_WINDOW_DAYS` | `14` |
| `FUTURE_WINDOW_DAYS` | `14` |
| 기본 필터 | High + Medium ON, Low OFF |
| `INLINE_EVENT_MAX` | `2` (셀에 인라인 미리보기 최대 2건) |
| `CALENDAR_ANALYZED_IMPACTS` | `['High', 'Medium']` (분석 대상 임팩트) |
| sentiment 한국어 레이블 | `bullish` → 긍정, `neutral` → 중립, `bearish` → 부정 |
| degrade 복사본 | `미국 거시 경제 데이터를 불러오지 못했어요` |
| degrade noindex | `generateMetadata → robots: noindex` |
| AI 모드 prod | 실제 LLM/worker (`E2E_TEST` 미설정) |
| AI 모드 E2E | `FakeEconomyProvider` + 시드 DB (`E2E_TEST=1`) |

---

## A. CURL 트랙 (응답값 / Status Code)

### TC-C01 — 페이지 정상 렌더 (200 + SSR 텍스트)
- **ID**: TC-C01 · **Track**: curl · **Priority**: P0
- **Title**: `GET /economy` 200 + h1·지표·캘린더 SSR 텍스트
- **Preconditions**: 서버 기동
- **Steps**:
  ```bash
  curl -s -o /tmp/economy.html -w "%{http_code}\n" "$BASE/economy"
  grep -o "미국 경제 — 지표·캘린더 한눈에" /tmp/economy.html | head -1
  grep -o "경제 캘린더" /tmp/economy.html | head -1
  grep -o "경제지표" /tmp/economy.html | head -1
  ```
- **Expected**: HTTP 200. HTML에 h1 `미국 경제 — 지표·캘린더 한눈에`, `경제지표`, `경제 캘린더` 포함.

### TC-C02 — 과거 + 미래 이벤트가 SSR HTML에 존재 (크롤러 색인)
- **ID**: TC-C02 · **Track**: curl · **Priority**: P0
- **Title**: ±14d 윈도 내 이벤트가 SSR HTML에 박힘 — JS 없이도 검색 엔진이 색인 가능
- **Preconditions**: TC-C01 통과
- **Steps**:
  ```bash
  # 기존 시드 이벤트 — 항상 존재
  grep -o "Fed Rate Decision" /tmp/economy.html | head -1
  # SP-B 시드 이벤트 — INDICATOR_NAME_KO 매핑 결과 (한국어 레이블)
  grep -o "비농업 고용" /tmp/economy.html | head -1
  # SP-D 시드 이벤트 sentiment 배지
  grep -o "긍정" /tmp/economy.html | head -1
  # SP-D summaryKo
  grep -o "비농업 고용이 예상치를 크게 상회해" /tmp/economy.html | head -1
  ```
- **Expected**: 4개 패턴 모두 1건 이상 매칭. DayDetailPanel은 `hidden` 속성으로 비선택 패널도 DOM에 항상 존재하므로 크롤러가 전체 이벤트 텍스트를 색인할 수 있다.

### TC-C03 — SP-B 한국어 레이블 SSR (dict 매핑)
- **ID**: TC-C03 · **Track**: curl · **Priority**: P0
- **Title**: `INDICATOR_NAME_KO` 사전 등재 지표명이 한국어로 변환돼 SSR HTML에 포함
- **Preconditions**: 시드 이벤트 `Nonfarm Payrolls` 존재 (E2E DB 또는 prod FMP 데이터)
- **Steps**:
  ```bash
  grep -c "비농업 고용" /tmp/economy.html   # 1 이상 기대
  grep -c "Nonfarm Payrolls" /tmp/economy.html  # 영어 원문도 존재할 수 있음(event 필드 raw)
  ```
- **Expected**: `비농업 고용` 1건 이상. `INDICATOR_NAME_KO['Nonfarm Payrolls']` = `비농업 고용`이 서버 `resolveIndicatorLabels`에서 합성됐음을 확인. 영어 원문은 dict miss fallback이 아님을 뜻하므로 `비농업 고용` 존재가 핵심.

### TC-C04 — SP-D sentiment 배지 + summaryKo SSR
- **ID**: TC-C04 · **Track**: curl · **Priority**: P0
- **Title**: 분석된 이벤트의 sentiment 배지(긍정)와 summaryKo가 SSR HTML에 포함
- **Preconditions**: 시드 이벤트 `Nonfarm Payrolls` sentiment=bullish 존재
- **Steps**:
  ```bash
  grep -o "긍정" /tmp/economy.html | head -1
  grep -o "비농업 고용이 예상치를 크게 상회해 노동시장 강세를 확인했습니다" /tmp/economy.html | head -1
  grep -o "고용 호조는 연준의 금리 인하 속도를 늦출 수 있어 달러 강세 요인입니다" /tmp/economy.html | head -1
  ```
- **Expected**: 3개 패턴 모두 1건 이상 매칭. `SENTIMENT_LABEL['bullish']` = `긍정`. summaryKo + interpretationKo가 DayDetailPanel 안에 박힘(hidden 패널 포함).

### TC-C05 — JSON-LD 4종 (WebSite + 3 콘텐츠 타입)
- **ID**: TC-C05 · **Track**: curl · **Priority**: P0
- **Title**: `<script type="application/ld+json">` 4개 존재 + valid JSON
- **Preconditions**: TC-C01 통과
- **Steps**:
  ```bash
  curl -s "$BASE/economy" \
    | grep -o '"@type":"[^"]*"' | sort -u
  # 기대 타입: WebSite, WebPage, BreadcrumbList, FAQPage
  ```
- **Expected**: `@type` 값에 `WebSite`, `WebPage`, `BreadcrumbList`, `FAQPage` 포함. 각 블록이 valid JSON (jq 파싱 통과). BreadcrumbList 첫 item=`Siglens`(position 1). FAQPage `mainEntity`에 경제 관련 Question 존재.

### TC-C06 — canonical / OG / twitter 메타
- **ID**: TC-C06 · **Track**: curl · **Priority**: P0
- **Title**: canonical·og:title·og:url·twitter card 정합
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s "$BASE/economy" \
    | grep -o '<link rel="canonical"[^>]*>\|og:title[^>]*>\|og:url[^>]*>\|twitter:card[^>]*>'
  ```
- **Expected**: canonical = `${SITE_URL}/economy`. og:title 포함 `미국 경제`. og:url = canonical. og:locale=ko_KR, og:siteName=Siglens. twitter:card=`summary_large_image`.

### TC-C07 — degrade noindex (E2E_ECONOMY_FORCE_EMPTY)
- **ID**: TC-C07 · **Track**: curl · **Priority**: P1
- **Title**: `E2E_ECONOMY_FORCE_EMPTY=1` 빌드에서 메타 noindex + degrade 복사본 존재
- **Preconditions**: `E2E_TEST=1 E2E_ECONOMY_FORCE_EMPTY=1 yarn build && yarn start -p 4300` 별도 기동
- **Steps**:
  ```bash
  curl -s "$BASE/economy" | grep -o "noindex"
  curl -s "$BASE/economy" | grep -o "미국 거시 경제 데이터를 불러오지 못했어요"
  ```
- **Expected**: `noindex` 존재. degrade 복사본 존재. 정상 섹션(`경제지표`) 미존재(null 스냅샷).

### TC-C08 — ISR cold-gen 안정성
- **ID**: TC-C08 · **Track**: curl · **Priority**: P0
- **Title**: 미캐시 첫 요청에서 500/DYNAMIC_SERVER_USAGE 없음
- **Preconditions**: `yarn start`(prod 모드), 빌드 직후 첫 방문.
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/economy"
  grep -i "DYNAMIC_SERVER_USAGE\|connection()" /tmp/build.log || echo "OK"
  ```
- **Expected**: 첫 요청 200. 서버 로그 DYNAMIC_SERVER_USAGE 0건. `connection()` 호출 없음(`/economy`는 동적 API 미사용).

### TC-C09 — 봇 UA → 페이지 200, AI 분석 미트리거
- **ID**: TC-C09 · **Track**: curl · **Priority**: P0
- **Title**: AI 봇 User-Agent로 /economy 요청 시 200 + SSR 정상
- **Preconditions**: prod-like 서버
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -H "User-Agent: GPTBot/1.0" "$BASE/economy"
  curl -s -o /dev/null -w "%{http_code}\n" -H "User-Agent: ClaudeBot/1.0" "$BASE/economy"
  ```
- **Expected**: 둘 다 200. 지표 그리드·캘린더는 SSR이라 봇 UA 무관 정상 렌더. MacroBriefing은 클라 트리거라 SSR HTML에는 skeleton만(봇 차단 복사본은 Chrome TC-B 계열에서 확인).

---

## B. CHROME 트랙 (시각 / 상호작용)

> 공통: DevTools Console + Network 탭 열고 시작. 각 케이스 종료 시 콘솔 에러 0 확인(TC-B09).

### TC-B01 — 캘린더 그리드 렌더 (기본 상태)
- **ID**: TC-B01 · **Track**: chrome · **Priority**: P0
- **Title**: 캘린더 섹션이 렌더되고 High+Medium 이벤트가 표시됨
- **Preconditions**: `$BASE/economy` 방문
- **Steps**:
  1. 페이지 진입.
  2. `경제 캘린더` h2 확인.
  3. 필터 칩 그룹(`aria-label="중요도 필터"`)에서 높음·보통 `aria-pressed=true`, 낮음 `aria-pressed=false` 확인.
  4. 그리드 셀에 이벤트 점 + 건수가 표시되는지 확인.
- **Expected**: h2 `경제 캘린더`(한국시간) 가시. 필터 칩 기본 상태 High+Med ON, Low OFF. 셀에 색상 점(빨강=High, 노랑=Med) + 건수 표시.

### TC-B02 — SP-B 한국어 레이블 + 영어 fallback
- **ID**: TC-B02 · **Track**: chrome · **Priority**: P0
- **Title**: INDICATOR_NAME_KO 등재 이벤트는 한국어, 미등재는 영어 원문 표시
- **Preconditions**: TC-B01 상태
- **Steps**:
  1. 'Nonfarm Payrolls' 이벤트가 있는 날짜 셀 클릭.
  2. 상세 패널에서 `비농업 고용` 텍스트 확인.
  3. INDICATOR_NAME_KO에 없는 이벤트 날짜 클릭 → 영어 원문 그대로 표시 확인.
- **Expected**: 사전 등재(`Nonfarm Payrolls`) → `비농업 고용`. 미등재 이벤트 → 영어 원문 그대로. 혼용 없음.

### TC-B03 — SP-B 375px truncation (모바일)
- **ID**: TC-B03 · **Track**: chrome · **Priority**: P1
- **Title**: 모바일 375px에서 긴 한국어 레이블이 셀 인라인 미리보기에서 잘림 처리됨
- **Preconditions**: DevTools device toolbar 375px
- **Steps**:
  1. 375px 설정 후 `$BASE/economy` 방문.
  2. 인라인 미리보기 텍스트(`INLINE_EVENT_MAX=2`)가 셀 너비에서 overflow 없이 표시되는지 확인.
  3. `document.documentElement.scrollWidth - clientWidth > 0` 평가.
- **Expected**: 가로 overflow 0 (body 좌우 스크롤 없음). 긴 레이블은 ellipsis 또는 줄바꿈으로 처리. 셀이 뷰포트를 벗어나지 않음.

### TC-B04 — SP-C 중요도 필터 토글
- **ID**: TC-B04 · **Track**: chrome · **Priority**: P0 ★ 필수
- **Title**: 낮음 칩 토글 ON/OFF 시 Low 이벤트 표시/숨김 전환
- **Preconditions**: TC-B01 상태
- **Steps**:
  1. 필터 그룹에서 `낮음` 버튼 확인(`aria-pressed=false`).
  2. `낮음` 클릭 → `aria-pressed=true` 전환 확인.
  3. 시드의 Low 이벤트(`MBA Mortgage Applications`)가 있는 today+2 날짜 셀 클릭.
  4. 상세 패널에 `MBA Mortgage Applications` 행이 가시화(`hidden` 속성 제거) 확인.
  5. 다시 `낮음` 클릭 → `aria-pressed=false`, 해당 `<li hidden>` 복귀 확인.
- **Expected**: 낮음 칩 토글마다 aria-pressed 상태 변경. 상세 패널 `<li>` 요소의 `hidden` 속성이 activeImpacts 상태에 연동. 셀 건수도 Low 포함/제외에 따라 변경.

### TC-B05 — SP-C 필터 색상 (High/Med/Low 시각 차별화)
- **ID**: TC-B05 · **Track**: chrome · **Priority**: P1
- **Title**: 임팩트 칩 색상이 스펙과 일치 (High=빨강계, Med=노랑계, Low=회색계)
- **Preconditions**: TC-B04 상태 (낮음 ON 포함)
- **Steps**:
  1. `높음` 칩 배경/텍스트 색상 확인.
  2. `보통` 칩 색상 확인.
  3. `낮음` 칩(ON 상태) 색상 확인.
  4. 셀 임팩트 점 색상 확인.
- **Expected**: 높음=`bg-ui-danger/15 text-ui-danger-text`, 보통=`bg-ui-warning/15 text-ui-warning-text`, 낮음=`bg-secondary-700 text-secondary-200`. 셀 점: High=빨강(`bg-ui-danger`), Med=노랑(`bg-ui-warning`), Low=회색(`bg-secondary-500`).

### TC-B06 — SP-D sentiment 배지 + summaryKo (상세 패널)
- **ID**: TC-B06 · **Track**: chrome · **Priority**: P0 ★ 필수
- **Title**: 분석 이벤트 날짜 선택 시 sentiment 배지·summaryKo·interpretationKo 표시
- **Preconditions**: `$BASE/economy` 방문, `Nonfarm Payrolls` 이벤트 날짜 선택
- **Steps**:
  1. 'Nonfarm Payrolls' 이벤트가 있는 날짜 셀 클릭.
  2. 상세 패널에서 sentiment 배지 텍스트 확인.
  3. summaryKo 텍스트 확인.
  4. interpretationKo 텍스트 확인.
  5. 배지 배경색 확인(bullish = 초록계).
- **Expected**: 배지 `긍정`(`SENTIMENT_LABEL['bullish']`). summaryKo `비농업 고용이 예상치를 크게 상회해 노동시장 강세를 확인했습니다.` 표시. interpretationKo `고용 호조는 연준의 금리 인하 속도를 늦출 수 있어 달러 강세 요인입니다.` 표시. 배지 색상 `bg-ui-success/10 text-ui-success-text`(AA contrast 통과).

### TC-B07 — SP-D AA 대비 (sentiment 배지)
- **ID**: TC-B07 · **Track**: chrome · **Priority**: P1
- **Title**: sentiment 배지 텍스트 대비율 AA 기준(4.5:1) 통과
- **Preconditions**: TC-B06 상태
- **Steps**:
  DevTools → Inspect → Computed → 배지 `color`/`background-color` 값 추출 후 대비율 계산. 또는 Accessibility tab에서 `긍정` 텍스트의 contrast ratio 확인.
- **Expected**: bullish 배지(`text-ui-success-text` on `bg-ui-success/10`) 대비율 ≥ 4.5:1. neutral·bearish 배지도 동일 기준 통과.

### TC-B08 — 날짜 선택 → 상세 패널 전환 (aria 정합)
- **ID**: TC-B08 · **Track**: chrome · **Priority**: P0 ★ 필수
- **Title**: 날짜 셀 클릭 시 해당 패널만 표시, 이전 선택 패널 hidden 복귀
- **Preconditions**: TC-B01 상태
- **Steps**:
  1. 날짜 A 셀 클릭 → 패널 A `hidden` 제거 + `aria-pressed=true` 확인.
  2. 날짜 B 셀 클릭 → 패널 B 표시 + 패널 A 다시 `hidden` 확인.
  3. 날짜 B 셀 재클릭(토글 OFF) → 패널 B `hidden` 복귀 + `aria-pressed=false` 확인.
- **Expected**: 단일 선택 토글. 패널 aria-labelledby가 대응 버튼 id와 일치. 상세 패널 전환에 manual sleep 없이 Playwright auto-wait 동작.

### TC-B09 — 콘솔 에러/경고 0
- **ID**: TC-B09 · **Track**: chrome · **Priority**: P0
- **Title**: 런타임 콘솔 에러/경고 0 (의도된 warn 제외)
- **Preconditions**: 위 Chrome 케이스 전체 수행 중 Console 모니터
- **Steps**: Console 탭 열고 TC-B01~B08 수행. 완료 후 확인.
- **Expected**: React hydration mismatch, key 경고, uncaught error 0건. 허용 warn: `[useIndicatorTranslationTrigger] ...` (AI 번역 트리거) 정도. 그 외 에러/경고 없음.

### TC-B10 — Safari/WebKit 호환
- **ID**: TC-B10 · **Track**: chrome · **Priority**: P1
- **Title**: Safari(WebKit)에서 필터 토글·날짜 선택·sentiment 배지 정상
- **Preconditions**: Safari 또는 Playwright WebKit 프로젝트
- **Steps**: TC-B04(필터 토글) + TC-B06(sentiment) + TC-B08(날짜 선택) Safari에서 반복.
- **Expected**: 동일 동작. iOS Safari 특유의 `fixed` overflow 버그 없음. Radix aria-hidden 시트 이슈 없음.

### TC-B11 — 375px 가로 오버플로 없음
- **ID**: TC-B11 · **Track**: chrome · **Priority**: P0
- **Title**: 모바일 375px에서 /economy 가로 스크롤 없음
- **Preconditions**: DevTools 375px × 667px
- **Steps**:
  ```js
  document.documentElement.scrollWidth - document.documentElement.clientWidth
  ```
  → 0 이하여야 함.
- **Expected**: 오버플로 0px. 캘린더 그리드 테이블이 375px 안에서 줄바꿈/스크롤 처리.

---

## C. 안정성 / 회귀 매핑

| Spec ID | 설명 | 커버하는 Test Case |
|---|---|---|
| SP-A | DB 기반 캘린더(now-relative 시드) 회귀 픽스 | TC-C01, TC-C02, TC-C08 |
| SP-B | 한국어 레이블(dict 매핑) | TC-C03, TC-B02, TC-B03 |
| SP-C | 중요도 필터(High/Med/Low 토글) | TC-B04, TC-B05 |
| SP-D | AI sentiment 배지 + 요약 | TC-C04, TC-B06, TC-B07 |
| 기존 | ISR cold-gen DSU=0 | TC-C08 |
| 기존 | 봇 UA 200 + SSR 정상 | TC-C09 |
| 기존 | degrade noindex | TC-C07 |

---

## D. 합격 기준 (Exit Criteria)

- Curl TC-C01~C09 전부 PASS.
- Chrome TC-B01~B11 전부 PASS.
- prod build exit 0, 런타임 콘솔 에러 0 (TC-B09).
- ISR cold-gen 500 0건 (TC-C08).
- ★ 필수 3종 PASS:
  - **TC-B04** SP-C: 낮음 칩 토글 — Low 이벤트 표시/숨김 전환
  - **TC-B06** SP-D: 날짜 선택 후 sentiment 배지(`긍정`) + summaryKo 표시
  - **TC-B08** SP-B: 날짜 선택 → `비농업 고용` 한국어 레이블 상세 패널 표시
