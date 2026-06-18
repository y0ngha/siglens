# `/economy` 프로덕션-라이크 검증 스펙

- 대상: 새 App Router 정적 ISR 페이지 `/economy` (branch `feat/economy-page`, PR #600)
- 실행 환경: `yarn build && yarn start`, `http://localhost:4200/economy`
- 작성일: 2026-06-17

---

## 1. 검증 범위 (Scope)

이 스펙이 다루는 것:

- 프로덕션 빌드(`yarn build && yarn start`) 기준의 SSR HTML, 응답 헤더, ISR 캐시 동작
- SEO 메타데이터·JSON-LD 구조·canonical/og/twitter 헤더
- 9종 경제지표 + 채권/스프레드 카드 + 캘린더의 데이터 정합성·렌더링
- MacroBriefing 클라이언트 흐름(서버액션 submit → poll → 알림/봇 차단/에러 알림)
- 디그레이드 경로(`isEmptyEconomySnapshot` true) — 200 + `robots: noindex`
- 봇 UA 경로
- 페이지 성능·리소스 새너티 (LCP/네트워크 요청 수 등 가벼운 체크)

이 스펙이 다루지 않는 것 (Non-goals):

- Playwright e2e 스펙 — 별도 `tests/e2e/` 스위트에서 실행
- 부하/스트레스 테스트 (k6, autocannon 등)
- siglens-core 내부 도메인 로직 단위 테스트 (해당 레포에서 커버)
- Vercel 프로덕션 트래픽/엣지 캐시(CF) 검증 — 본 스펙은 로컬 `yarn start`만 가정
- 인증·세션·tier 게이팅 — `/economy`는 비회원 접근 가능 경로

---

## 2. 환경 설정 (Environment Setup)

### 필수

`.env.local`에 다음 키:

```bash
FMP_API_KEY=<유효한 FMP 키>
```

- 누락 시 `getEconomySnapshotStatic`가 빈 스냅샷을 반환하고 `isEmptyEconomySnapshot === true` ⇒ 디그레이드 경로 진입
- 디그레이드는 200을 반환해야 하며 `noindex`로 메타가 바뀜 → TC-H에서 검증

### 선택 (Briefing 정상 경로용)

```bash
WORKER_URL=<macro briefing 워커 엔드포인트>
WORKER_SECRET=<공유 시크릿>
REDIS_URL=<redis 인스턴스>
```

- 누락 시: 브리핑 서버액션이 `{ ok: false, error: 'server_error' }` 반환 → 클라가 `role="alert"` 알림 텍스트 렌더 (TC-G-004)
- Redis 누락: `unstable_cache`가 in-memory로 동작 (HIT/MISS 헤더는 정상 노출되어야 함)

### 빌드/기동

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+economy-page
yarn build
yarn start          # listens on 4200
```

---

## 3. Pre-flight (페이지 테스트 전 새너티)

| 항목 | 명령 | 기대 |
|---|---|---|
| PF-1 | `yarn build 2>&1 | tee /tmp/build.log; echo $?` | exit 0, 로그에 `○ /economy 1h 1y` 마커 존재 |
| PF-2 | `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4200/` | `200` (서버 살아있음) |
| PF-3 | `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4200/economy` | `200` |
| PF-4 | `redis-cli -u "$REDIS_URL" PING` (REDIS 사용 시) | `PONG` 또는 미사용 시 N/A로 명시 |
| PF-5 | `grep -E '^FMP_API_KEY=' .env.local` | 값이 빈 문자열이 아님 |

PF-1이 실패하면 이후 TC 전부 차단. PF-4가 PONG이 아니어도 진행하되 "cold cache run" 임을 보고에 명기.

---

## 4. Test Cases

### (A) Response & Status

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-A-001 | 200 응답 + HTML content-type | curl | `curl -sI http://localhost:4200/economy` | `HTTP/1.1 200 OK`, `content-type: text/html; charset=utf-8` | 라우트 자체가 살아있음 |
| TC-A-002 | HEAD 요청도 200 | curl | `curl -sI -X HEAD http://localhost:4200/economy` | `200`, body 없음 | HEAD 처리 회귀 방지 |
| TC-A-003 | 잘못된 메서드는 405 또는 GET 폴백 | curl | `curl -sI -X POST http://localhost:4200/economy` | `405` 또는 `200` (Next 기본). 5xx 아님 | 메서드 핸들링 회귀 |
| TC-A-004 | gzip/br 인코딩 협상 | curl | `curl -sI -H "Accept-Encoding: gzip, br" http://localhost:4200/economy` | `content-encoding: gzip` 또는 `br` | 전송 효율 — 미적용 시 Fast Origin Transfer 폭증 |
| TC-A-005 | cache-control 헤더 존재 | curl | `curl -sI http://localhost:4200/economy | grep -i '^cache-control:'` | `s-maxage=...` 또는 `public, max-age=0, must-revalidate` 등 Next ISR 패턴 | ISR 응답 정합성 |

### (B) SSR HTML & SEO

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-B-001 | h1 정확 일치 | curl | `curl -s http://localhost:4200/economy | grep -oE '<h1[^>]*>[^<]+</h1>'` | `<h1 ...>미국 경제 — 지표·캘린더 한눈에</h1>` 포함 | 최상위 헤더 회귀 |
| TC-B-002 | 세 섹션 h2 모두 SSR | curl | `curl -s http://localhost:4200/economy | grep -oE '<h2[^>]*>[^<]*</h2>'` | `경제지표`, `경제 캘린더`, `거시 경제 브리핑` (또는 동등 명칭) 포함 | 섹션 누락 방지 |
| TC-B-003 | 카테고리 4개 서브헤딩 | curl | `curl -s http://localhost:4200/economy | grep -oE '금리|물가|성장·경기|고용'` | 4개 모두 1회 이상 매치 | 그리드 카테고리 누락 |
| TC-B-004 | section landmark aria-labelledby | both | curl로 `aria-labelledby="` 카운트 / Chrome으로 `document.querySelectorAll('section[aria-labelledby]').length` | 3 | 랜드마크 a11y |
| TC-B-005 | 브리핑 스켈레톤 aria-busy SSR | curl | `curl -s http://localhost:4200/economy | grep -E 'aria-busy="true"' ` | 매치 존재. 같은 요소에 `aria-label="거시 경제 브리핑 로딩 중"` | 클라 hydration 전 a11y 라벨 |
| TC-B-006 | `<time datetime>` ISO 정규화 | both | curl HTML에서 `grep -oE '<time datetime="[^"]+"'` 또는 Chrome `Array.from(document.querySelectorAll('time')).map(t => t.dateTime)` | 모든 값이 `YYYY-MM-DDTHH:mm` 패턴(공백 없음) | `replace(' ', 'T')` 정규화 회귀 |
| TC-B-007 | 캘린더 임팩트 배지 | curl | `curl -s http://localhost:4200/economy | grep -oE '높음|보통|낮음'` | 최소 한 가지 이상 매치 (또는 빈 안내문 TC-F-002) | 임팩트 매핑 |
| TC-B-008 | 천 단위 콤마 (ko-KR) | curl | `curl -s http://localhost:4200/economy | grep -oE '[0-9],[0-9]{3}'` | 최소 1건 매치 (또는 모든 값이 1,000 미만이면 스킵 보고) | NumberFormat 회귀 |
| TC-B-009 | robots 메타 정상 경로에서는 noindex 없음 | curl | `curl -s http://localhost:4200/economy | grep -i 'name="robots"'` | `noindex` 미포함 (디그레이드 아닐 때) | 디그레이드/정상 경로 메타 분기 |

### (C) Metadata & JSON-LD

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-C-001 | `<title>` 정확 | curl | `curl -s http://localhost:4200/economy | grep -oE '<title>[^<]+</title>'` | `미국 경제 — 지표·캘린더 한눈에 | Siglens` | 루트 layout suffix 결합 |
| TC-C-002 | description ≤ 120자 | curl | `curl -s http://localhost:4200/economy | grep -oE '<meta name="description" content="[^"]+"'` | content 길이 ≤ 120 | SEO 클램프 |
| TC-C-003 | canonical | curl | `curl -s http://localhost:4200/economy | grep -i 'rel="canonical"'` | `href="https://siglens.io/economy"` (또는 `SITE_URL/economy`) | canonical 정합 |
| TC-C-004 | OG locale/type/image | curl | `curl -s http://localhost:4200/economy | grep -iE 'og:(locale|type|image)'` | `og:locale` = `ko_KR`, `og:type` = `website`, `og:image` 값에 `/og-image.png` | OG 폴백 회귀 |
| TC-C-005 | OG 이미지 사이즈 | curl | OG 메타에서 `og:image:width` `og:image:height` | `1200` / `630` | 카드 비율 |
| TC-C-006 | Twitter summary_large_image | curl | `grep -i 'twitter:card'` | `summary_large_image` | Twitter 카드 |
| TC-C-007 | keywords 핵심어 포함 | curl | `curl -s http://localhost:4200/economy | grep -oE '<meta name="keywords" content="[^"]+"'` | `미국 경제 지표`, `미국 기준금리`, `FOMC 일정`, `CPI 발표`, `미국 실업률`, `경제 캘린더`, `장단기 금리차`, `미국 경기침체` 8개 전부 매치 | 키워드 회귀 |
| TC-C-008 | JSON-LD 블록 2개 | curl | `curl -s http://localhost:4200/economy | grep -c '<script type="application/ld+json"'` | `2` | LD 스킴 누락 |
| TC-C-009 | JSON-LD `@type` 검증 | curl | JSON-LD 블록을 `python3 -c "import sys, json, re; ..."` 등으로 파싱 | 한 블록 `@type === 'WebPage'`, 다른 블록 `@type === 'BreadcrumbList'` | 스킴 정확성 |
| TC-C-010 | BreadcrumbList 최소 항목 | curl | JSON-LD BreadcrumbList의 `itemListElement` length | ≥ 2 (홈 + 현재) | breadcrumb 정합 |

### (D) ISR / Cache Behavior

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-D-001 | Cold-gen은 throw 없음 | both | 빌드 직후 워밍 안 된 상태에서 `curl -sI http://localhost:4200/economy` 한 번 | 200, `x-nextjs-cache` 헤더 존재(`MISS` 또는 부재 후 두 번째에서 HIT). 서버 stderr에 `DYNAMIC_SERVER_USAGE` 없음 | ISR cold-gen에서 `connection()` 등 dynamic API 호출 회귀 |
| TC-D-002 | 두 번째 요청 HIT | curl | TC-D-001 직후 `curl -sI http://localhost:4200/economy | grep -i x-nextjs-cache` | `x-nextjs-cache: HIT` | ISR 캐시 작동 |
| TC-D-003 | 빌드 로그 마커 | bash | `grep -E '/economy\s+1h\s+1y' /tmp/build.log` | 매치 존재 (`○ /economy 1h 1y`) | revalidate=86400 리터럴이 라우트 분석에 반영 |
| TC-D-004 | ETag/Last-Modified 새너티 | curl | `curl -sI http://localhost:4200/economy | grep -iE '^(etag|last-modified):'` | 최소 한 가지 존재 (Next 정적/ISR은 보통 etag) | 조건부 요청 가능성 |
| TC-D-005 | 빈 스냅샷이면 redis pollution 없음 | bash + redis | 디그레이드 환경(FMP_API_KEY 무효)으로 한 번 요청 후 `redis-cli -u $REDIS_URL --scan --pattern '*economy-snapshot-static*'` | 0건 또는 빈-셋 키 없음 (`shouldCache` 가드) | 빈 결과 캐싱 방지 |
| TC-D-006 | dateHour 버킷팅 | bash | 두 번 연속 요청 (같은 시각) 후 redis 키 카운트 | `economy-briefing-peek-static:YYYY-MM-DDTHH` 한 종류만 (1시간 내) | 시간버킷 회귀 |

### (E) Indicator Grid (Data Integrity)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-E-001 | 9종 지표 + 채권/스프레드 3종 카드 SSR | curl | `curl -s http://localhost:4200/economy | grep -oE 'data-card-id="[^"]+"' | sort -u` (또는 카드 라벨 텍스트로 카운트) | 정상 경로에서 최대 12개 카드 라벨이 등장; 누락 카드는 그 카드만 사라짐 (페이지 자체는 200) | 카드 단위 graceful 누락 |
| TC-E-002 | 카드 라벨/단위/툴팁 일치 | chrome | navigate → `Array.from(document.querySelectorAll('[data-card-id]')).map(el => ({id: el.dataset.cardId, label: el.querySelector('.label')?.textContent, unit: el.querySelector('.unit')?.textContent}))` | 모든 항목이 `src/shared/config/economyIndicators.ts` 레지스트리 값과 일치 | 레지스트리 ↔ 렌더 정합 |
| TC-E-003 | 델타 부호별 색상 | chrome | 각 카드의 델타 요소 `getComputedStyle(el).color` 비교 | 양수 카드는 `--color-ui-success` 토큰, 음수 카드는 `--color-ui-danger` 토큰 | Tailwind ui-* 토큰 매핑 |
| TC-E-004 | sub-precision 델타는 텍스트 치환 | curl | `curl -s http://localhost:4200/economy | grep -F '전기 대비 변화 없음'` | 해당 케이스가 있으면 매치; 없으면 보고에 "no sub-precision case this run" 명기 | `parseFloat(toFixed(p)) === 0` 분기 |
| TC-E-005 | 2s10s 스프레드 카드 존재 | curl | `curl -s http://localhost:4200/economy | grep -F '2s10s 스프레드'` | 매치 1건 | 파생 카드 누락 회귀 |
| TC-E-006 | 2s10s 양수면 success 토큰 | chrome | 스프레드 카드 값 요소 `classList` 또는 computed color | 값 ≥ 0 ⇒ `text-ui-success`; 값 < 0 ⇒ `text-ui-danger` | 정확히 0인 경우도 success로 처리 (양수 분기) |
| TC-E-007 | 채권 2년/10년 카드 라벨 | curl | `grep -E '2년물 국채|10년물 국채'` | 둘 다 매치 | 라벨 회귀 |
| TC-E-008 | 지표 누락 카드 graceful 처리 | curl + chrome | FMP에서 한 지표만 빈 응답이 오도록 임시 환경 또는 mocked snapshot으로 재현 (수동: 키 잘못 입력 후 빌드 X — 보고에 한 케이스로 명시) | 해당 카드 미렌더, 페이지 200, 콘솔 에러 0 | 부분 실패 격리 |
| TC-E-009 | 카드 정렬 순서 | chrome | `document.querySelectorAll('section[aria-labelledby*="indicator"] [data-card-id]')` 순서 추출 | 레지스트리 정의 순서와 일치 (금리 → 물가 → 성장·경기 → 고용 그룹별 정렬) | 정렬 회귀 |

### (F) Calendar

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-F-001 | 캘린더 행 모두 US 이벤트 | chrome | `Array.from(document.querySelectorAll('[data-calendar-row]')).map(r => r.dataset.country)` | 모든 항목 `US` 또는 `미국` | 국가 필터 회귀 |
| TC-F-002 | 빈 캘린더 안내 문구 | curl | (빈 응답 환경) `curl -s http://localhost:4200/economy | grep -F '다가오는 미국 경제 발표 일정이 아직 없어요.'` | 일정 0건이면 매치, 있으면 N/A | 빈 상태 카피 |
| TC-F-003 | 날짜 오름차순 | chrome | `Array.from(document.querySelectorAll('time[datetime]')).map(t => t.dateTime)` 비교 | 정렬 결과가 원본과 동일 (ascending) | 정렬 회귀 |
| TC-F-004 | impact 배지 매핑 | chrome | 각 행의 impact 셀 텍스트 ↔ tooltip 또는 data-attr | High→`높음`, Medium→`보통`, Low→`낮음` | i18n 매핑 |
| TC-F-005 | 천 단위 콤마 | chrome | 숫자 값 셀의 textContent | `/^-?[\d,]+(\.\d+)?$/` 패턴, `Intl.NumberFormat('ko-KR')` 결과와 일치 | NumberFormat 회귀 |
| TC-F-006 | `<time datetime>` ISO 패턴 | chrome | `Array.from(document.querySelectorAll('time')).every(t => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.dateTime))` | `true` | 공백→T 정규화 |

### (G) Macro AI Briefing (Client Flow)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-G-001 | 초기 SSR은 스켈레톤 | curl | `curl -s http://localhost:4200/economy | grep -E 'aria-busy="true"[^>]*aria-label="거시 경제 브리핑 로딩 중"'` | 매치 존재 | 클라 마운트 전 a11y 스켈레톤 |
| TC-G-002 | 마운트 직후 submit 액션 호출 | chrome | navigate, 네트워크 기록 시작 → 1s 후 `read_network_requests` | `submitMacroBriefingAction`에 해당하는 RSC/Server Action 요청 1건 | 클라 자동 submit |
| TC-G-003 | 정상 경로 polling 종료 | chrome | navigate 후 최대 60s 대기, DOM에서 regime 배지 텍스트 확인 | 배지 텍스트가 `확장|둔화|수축|회복|중립` 중 하나. 해당 요소에 `bg-ui-success/20 text-ui-success` 등 토큰 클래스 1쌍 존재 | poll→done 분기 |
| TC-G-004 | WORKER 누락 시 에러 알림 | both | `WORKER_URL`/`WORKER_SECRET` 미설정으로 재기동 → `curl -s http://localhost:4200/economy` (초기 HTML엔 스켈레톤). Chrome으로 60s 후 DOM 확인 | `[role="alert"]` 요소가 존재하고 textContent에 `지금은 거시 브리핑을 만들지 못했어요. 잠시 후 다시 시도해 주세요.` 포함 | 디그레이드 카피 회귀 |
| TC-G-005 | 폴링 주기 5초 | chrome | navigate 후 20초간 네트워크 기록 | `pollMacroBriefingAction` 요청 간격이 평균 ~5s (±1s 허용) | 폴링 주기 회귀 |
| TC-G-006 | 콘솔 에러 0 | chrome | navigate 후 60s 대기 → `read_console_messages` | `error` 레벨 0건. (워커 의도적 미설정 케이스는 별도 보고) | 클라 안정성 |
| TC-G-007 | regime 색 토큰 매핑 | chrome | regime 배지 `getComputedStyle(el).color`/`backgroundColor` | success/warning/danger 토큰 중 정확히 한 쌍, 텍스트와 의미 일치 | 토큰 매핑 |

### (H) Degrade Path

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-H-001 | 디그레이드 시 200 유지 | curl | `FMP_API_KEY=invalid` 재기동 → `curl -sI http://localhost:4200/economy` | `200` (5xx 아님) | 외부 의존 실패에도 페이지 살아있음 |
| TC-H-002 | 디그레이드 메타 noindex | curl | 위 상태에서 `curl -s http://localhost:4200/economy | grep -i 'name="robots"'` | `noindex` 포함 | 빈 페이지 SEO 회피 |
| TC-H-003 | EconomyDegraded 카드 카피 | curl | `curl -s http://localhost:4200/economy | grep -F '잠시 후 다시 시도해 주세요'` | 매치 존재 (h2/h3 헤딩 내) | 디그레이드 UI |
| TC-H-004 | 디그레이드도 h1 동일 | curl | `grep -F '미국 경제 — 지표·캘린더 한눈에'` | 매치 존재 | h1은 보존 |
| TC-H-005 | 디그레이드 시 JSON-LD 생략 또는 최소 | curl | JSON-LD 블록 카운트 | 0 또는 1 (BreadcrumbList만 등) — 정상의 2개와 다름 | noindex와 LD 발행 정합 |
| TC-H-006 | 디그레이드 후 redis 키 미생성 | bash | TC-D-005와 동일 절차 | 0건 | shouldCache 가드 |

### (I) Bot Path

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-I-001 | Googlebot UA 200 | curl | `curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:4200/economy` | `200`, `content-type: text/html` | 봇 응답 정상 |
| TC-I-002 | 봇은 briefing 미생성 카피 | chrome | UA를 Googlebot으로 오버라이드(`emulate_user_agent` 또는 헤더 주입) 후 navigate, 60s 대기, DOM 확인 | 브리핑 영역 텍스트에 `크롤러 접근으로 분석을 생성하지 않았어요.` 포함, `[role="alert"]` 없음 | `isBot` ⇒ `botBlocked: true` 분기 |
| TC-I-003 | 봇 경로 JSON-LD 유지 | curl | TC-I-001 응답 본문 | JSON-LD 2블록 (WebPage, BreadcrumbList) 존재 | 봇 SEO 데이터 |
| TC-I-004 | 봇 경로 canonical 유지 | curl | 위 응답에서 canonical | `https://siglens.io/economy` | 봇이 받는 canonical 일관 |
| TC-I-005 | 봇은 polling 네트워크 안 일으킴 | chrome | UA Googlebot, 30s 모니터 | `pollMacroBriefingAction` 요청 0건 | 봇 트래픽 절감 |

### (J) Performance & Resource Sanity

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-J-001 | HTML 페이로드 합리적 | curl | `curl -s -o /tmp/economy.html http://localhost:4200/economy; wc -c /tmp/economy.html` | < 500 KB (gzip 전). 큰 인라인 데이터 누수 회귀 감지용 임계 | RSC payload 폭증 회귀 |
| TC-J-002 | 초기 JS 청크 수 | chrome | navigate 후 `read_network_requests` 중 `.js` 응답 카운트 | ≤ 20 (개발용 임계, 운영 빌드 기준). 회귀 시 변동 보고 | 번들 분할 회귀 |
| TC-J-003 | 폰트/이미지 요청 수 | chrome | navigate 후 `font|image` 분류 카운트 | font ≤ 4, image ≤ 5 (OG/og-image는 SSR에서 fetch되지 않음) | LCP 자원 누수 회귀 |
| TC-J-004 | 콘솔 warning ≤ 임계 | chrome | navigate 후 60s 대기 → `read_console_messages` | `warning` 레벨 ≤ 2 (Next dev-only 경고 제외). 신규 warning은 보고 | UI 회귀 조기 신호 |
| TC-J-005 | LCP 후보 식별 가능 | chrome | navigate, `PerformanceObserver` 스크립트로 LCP 요소 추출 | LCP 요소가 h1 또는 첫 카드. 외부 광고/iframe 아님 | LCP 회귀 |
| TC-J-006 | 네트워크 4xx/5xx 0 | chrome | navigate 후 30s 모니터 | 모든 응답 < 400 (의도적 401/403 디버그 라우트 제외) | silent error 감지 |
| TC-J-007 | redis MISS→HIT 전이 | curl | 첫 요청 (`MISS`/없음) → 둘째 요청 (`HIT`) `x-nextjs-cache` | 둘째에서 `HIT` | ISR 캐시 hit-rate 회귀 |

---

## 5. 보고 (Reporting)

각 TC 실행 후 다음 형식으로 결과 보고:

```
TC-A-001  PASS  http=200 ct=text/html
TC-B-001  PASS  h1 matched
TC-G-004  PASS  alert text matched ("지금은 거시 브리핑을 만들지 못했어요...")
TC-E-008  N/A   no missing-indicator case this run
TC-H-002  FAIL  expected noindex, got "index,follow"
```

전체 실행 후 그룹별 PASS/FAIL/N/A 합계를 마지막 줄에 요약.
