# `/economy` PR #603 Post-Audit-Fix 프로덕션-라이크 검증 스펙

- 대상: PR #603 (stacked on PR #600), branch `feat/economy-page-followup`
- 실행 환경: `yarn build && yarn start`, `http://localhost:4200/economy`
- 작성일: 2026-06-18
- 직전 스펙: `docs/superpowers/specs/2026-06-17-economy-prod-verification.md` (PR #600 base 검증)
- 컨텍스트: 10 review rounds + 5 fresh-context audits + 11 follow-up fixes 이후의 후속(post) 검증
- 워크트리: `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+economy-page/`

---

## 0. 요약 — Go/No-Go 결정 표 (Critical PASS 기준)

머지 가능 여부를 판정할 때 다음 항목이 **전부 PASS**여야 한다. 하나라도 FAIL이면 Blocker.

| # | Critical 항목 | 검증 TC | 머지 Gate |
|---|---|---|---|
| 1 | 정상 경로 200 + `text/html` | TC-A-001 | Blocker |
| 2 | 빌드 로그에 `○ /economy 1d 1y` ISR 마커 | PF-1, TC-D-003 | Blocker |
| 3 | JSON-LD 블록 **4개** (WebPage·BreadcrumbList·Dataset·FAQPage) | TC-C-008 | Blocker |
| 4 | WebPage JSON-LD에 `dateModified` **부재** | TC-C-011 | Blocker |
| 5 | 캘린더 h2에 `(미 동부시간)` sub-label SSR | TC-F-007 | Blocker |
| 6 | `<time datetime>`이 ET offset 포함(`-04:00` 또는 `-05:00`) | TC-F-008, TC-F-009 | Blocker |
| 7 | M3 quorum: 5/9 populated는 캐시 안 됨 | TC-I-001, TC-I-002 | Blocker |
| 8 | M3 quorum: 6/9 + treasury는 캐시 됨 | TC-I-003 | Blocker |
| 9 | M3 quorum: 6/9이지만 treasury/calendar 모두 null이면 캐시 안 됨 | TC-I-004 | Blocker |
| 10 | `E2E_ECONOMY_FORCE_EMPTY=1` → degrade UI + `robots:noindex,follow` + `canonical:null` | TC-H-001~004 | Blocker |
| 11 | 디그레이드 시에도 페이지 본문은 200 + h1 유지 | TC-H-005 | Blocker |
| 12 | 정상 경로 brief client flow: submit → poll → done | TC-G-003 | Blocker |
| 13 | 봇 UA 경로에서 polling 0건 | TC-I-101 (Bot Path) | Major |
| 14 | a11y: 페이지 내 `<h1>` 정확히 **1개** + h2 hierarchy 일관 | TC-J-001 | Major |
| 15 | 콘솔 error 0건 (정상 경로) | TC-G-006 | Major |
| 16 | 캐시 키 시간 버킷 1개만 생성 | TC-D-005 | Major |
| 17 | sitemap/robots 페이지 경로 단일 | (별도 스펙) | Out of scope |

> Blocker FAIL → 머지 차단, 회귀 보고. Major FAIL → 사용자에게 알리고 동의 시 머지. Minor는 follow-up 이슈로 정리.

---

## 1. 검증 범위 (Scope)

이 스펙이 다루는 것:

- PR #600에서 #603으로의 **변경 델타** 검증 — quorum 캐시, dateModified 제거, 캘린더 sub-label, ET offset, `EmptyEconomyProvider` env seam, JSON-LD 4블록
- 프로덕션 빌드(`yarn build && yarn start`) 기준의 SSR HTML, 응답 헤더, ISR 캐시 동작
- SEO 메타데이터·JSON-LD 구조·canonical/og/twitter 헤더
- 9종 경제지표 + 채권(2년/10년) + 2s10s 스프레드 카드 + 캘린더의 데이터 정합성·렌더링
- MacroBriefing 클라이언트 흐름 (서버액션 submit → poll → done/error/bot)
- 디그레이드 경로 — `E2E_ECONOMY_FORCE_EMPTY=1` env seam을 통한 강제 빈 스냅샷
- a11y 강화: 단일 h1, heading hierarchy, ARIA landmarks, 캘린더 sub-label 가독성
- 봇 UA 경로 (정상/디그레이드 양쪽)

이 스펙이 다루지 않는 것 (Non-goals):

- Playwright e2e 스펙 — `tests/e2e/economy.spec.ts` 등 별도 스위트
- 부하/스트레스 테스트
- siglens-core 내부 도메인 로직 단위 테스트
- Vercel 프로덕션 트래픽/엣지(CF) 검증 — 본 스펙은 로컬 `yarn start`만 가정
- 인증·세션·tier 게이팅 — `/economy`는 비회원 접근 경로
- 서버사이드 IP 기반 rate-limit 검증 — 현재 미구현(JSDoc에 known risk 명시), TC-G-RL-001에서 부재만 확인

---

## 2. 환경 설정 (Environment Setup)

### 필수 — 정상 경로용

`.env.local`에 다음:

```bash
FMP_API_KEY=<유효한 FMP 키>
SITE_URL=https://siglens.io   # canonical 생성용 (미설정 시 기본값 사용)
```

- 누락 시 `getEconomySnapshotStatic`가 빈 스냅샷 반환 가능 → 정상 경로 검증 불가

### 선택 — Briefing 정상 경로용

```bash
WORKER_URL=<macro briefing 워커 엔드포인트>
WORKER_SECRET=<공유 시크릿>
REDIS_URL=<redis 인스턴스>
```

- 누락 시: 브리핑 서버액션이 `{ ok: false, error: 'server_error' }` 반환 → 클라가 `role="alert"` 알림 텍스트 렌더 (TC-G-004)
- Redis 누락: `unstable_cache`가 in-memory로 동작, HIT/MISS 헤더 정상 노출

### 디그레이드 경로용 (필수 분리 실행)

```bash
E2E_ECONOMY_FORCE_EMPTY=1
NODE_ENV=production
NEXT_PUBLIC_FAKE_DATA_ALLOWED=1   # FakeEconomyProvider/EmptyEconomyProvider 활성 게이트
```

- `getEconomyProvider`가 `EmptyEconomyProvider`를 반환 → 전 축 null → `isEmptyEconomySnapshot=true`
- TC-H-* 그룹 전부 이 env로 재기동 후 실행
- ⚠️ 정상 경로와 디그레이드 경로는 **반드시 서버 재기동을 분리**(모듈 로드 시점에 provider 고정 가능성)

### 빌드/기동

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+economy-page
yarn build 2>&1 | tee /tmp/build-pr603.log
echo $?            # 반드시 직접 캡처 (파이프 마스킹 주의)
yarn start         # listens on 4200
```

---

## 3. Pre-flight (페이지 테스트 전 새너티)

| ID | 항목 | 명령 | 기대 |
|---|---|---|---|
| PF-1 | 빌드 성공 + ISR 마커 | `yarn build > /tmp/build-pr603.log 2>&1; echo $?` 후 `grep -E '○ */economy ' /tmp/build-pr603.log` | exit 0, 출력에 `○ /economy 1d 1y` (86400=1d) 표기 |
| PF-2 | 서버 헬스 | `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4200/` | `200` |
| PF-3 | 경제 페이지 헬스 | `curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4200/economy` | `200` |
| PF-4 | redis ping (옵션) | `redis-cli -u "$REDIS_URL" PING` | `PONG` 또는 미사용 시 N/A |
| PF-5 | FMP 키 존재 | `grep -E '^FMP_API_KEY=' .env.local \| head -c 50` | `FMP_API_KEY=<non-empty>` |
| PF-6 | 브랜치 확인 | `git rev-parse --abbrev-ref HEAD` | `feat/economy-page-followup` |
| PF-7 | core 버전 핀 (워크트리 트랩 회피) | `cat package.json \| grep siglens-core` 후 `yarn why @y0ngha/siglens-core \| head -3` | `package.json` 핀과 설치 버전 일치 |
| PF-8 | 인증/세션 env 누락 OK | 별도 확인 없이 진행 (인증은 옵션) | - |

PF-1 / PF-3 실패 시 이후 TC 차단. PF-7 mismatch이면 `rm -rf node_modules && yarn install` 후 재시도(워크트리 stale 트랩).

---

## 4. Test Cases

### (A) Response & Status

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-A-001 | 200 응답 + HTML content-type | curl | `curl -sI http://localhost:4200/economy` | `HTTP/1.1 200 OK`, `content-type: text/html; charset=utf-8` | 라우트 살아있음 (Critical) |
| TC-A-002 | HEAD 요청도 200 | curl | `curl -sI -X HEAD http://localhost:4200/economy` | `200`, body 없음 | HEAD 회귀 방지 |
| TC-A-003 | 잘못된 메서드 405/200 폴백 | curl | `curl -sI -X POST http://localhost:4200/economy` | `405` 또는 `200`, 5xx 아님 | 메서드 핸들링 |
| TC-A-004 | gzip/br 인코딩 협상 | curl | `curl -sI -H "Accept-Encoding: gzip, br" http://localhost:4200/economy` | `content-encoding: gzip` 또는 `br` | 전송 효율(Fast Origin Transfer 절감) |
| TC-A-005 | cache-control 헤더 존재 | curl | `curl -sI http://localhost:4200/economy \| grep -i '^cache-control:'` | `s-maxage=...` 또는 `public, max-age=0, must-revalidate` 등 Next ISR 패턴 | ISR 응답 정합성 |
| TC-A-006 | x-nextjs-cache 헤더 노출 | curl | 같은 응답 헤더 | `x-nextjs-cache: HIT \| MISS \| STALE` 중 하나 | ISR 캐시 가시성 |

### (B) SSR HTML & SEO basics

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-B-001 | h1 정확 일치 | curl | `curl -s http://localhost:4200/economy \| grep -oE '<h1[^>]*>[^<]+</h1>'` | `<h1 ...>미국 경제 — 지표·캘린더 한눈에</h1>` 매치 1건 | 최상위 헤더 회귀 |
| TC-B-002 | h1은 페이지 내 단 1개 | both | `grep -c '<h1' /tmp/economy.html` 또는 Chrome `document.querySelectorAll('h1').length` | `1` (정확히) | a11y heading uniqueness |
| TC-B-003 | 세 섹션 h2 모두 SSR | curl | `curl -s http://localhost:4200/economy \| grep -oE '<h2[^>]*>[^<]*</h2>'` | `경제지표`, `경제 캘린더`, `거시 경제 브리핑` (또는 동등 명칭) 포함 | 섹션 누락 방지 |
| TC-B-004 | 카테고리 4개 서브헤딩 | curl | `curl -s http://localhost:4200/economy \| grep -oE '금리\|물가\|성장·경기\|고용'` | 4개 모두 1회 이상 매치 | 그리드 카테고리 |
| TC-B-005 | section landmark `aria-labelledby` | both | curl로 카운트 / Chrome `document.querySelectorAll('section[aria-labelledby]').length` | `3` | 랜드마크 a11y |
| TC-B-006 | 브리핑 스켈레톤 `aria-busy` | curl | `curl -s http://localhost:4200/economy \| grep -E 'aria-busy="true"'` | 매치 존재, 같은 요소에 `aria-label="거시 경제 브리핑 로딩 중"` | 클라 hydration 전 a11y |
| TC-B-007 | 캘린더 임팩트 배지 | curl | `grep -oE '높음\|보통\|낮음'` | 최소 한 가지 매치 (또는 빈 캘린더 안내문) | 임팩트 매핑 |
| TC-B-008 | 천 단위 콤마 (ko-KR) | curl | `grep -oE '[0-9],[0-9]{3}'` | 최소 1건 (또는 모든 값 1,000 미만이면 스킵 보고) | NumberFormat 회귀 |
| TC-B-009 | robots 메타 정상 경로에서 noindex 없음 | curl | `grep -i 'name="robots"'` | `noindex` 미포함 | 정상/디그레이드 분기 |
| TC-B-010 | 정상 경로 canonical 존재 | curl | `grep -iE 'rel="canonical"'` | `href="https://siglens.io/economy"` (또는 SITE_URL) | canonical 정합 |

### (C) Metadata & JSON-LD (4 blocks, no dateModified)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-C-001 | `<title>` 정확 | curl | `curl -s http://localhost:4200/economy \| grep -oE '<title>[^<]+</title>'` | `미국 경제 — 지표·캘린더 한눈에 \| Siglens` | 루트 layout suffix 결합 |
| TC-C-002 | description ≤ 120자 | curl | `grep -oE '<meta name="description" content="[^"]+"'` | content 길이 ≤ 120 | SEO 클램프 |
| TC-C-003 | canonical | curl | `grep -i 'rel="canonical"'` | `https://siglens.io/economy` | canonical 정합 |
| TC-C-004 | OG locale/type/image | curl | `grep -iE 'og:(locale\|type\|image)'` | `og:locale=ko_KR`, `og:type=website`, `og:image` 값에 `/og-image.png` | OG 폴백 회귀 |
| TC-C-005 | OG 이미지 사이즈 | curl | `og:image:width`, `og:image:height` | `1200` / `630` | 카드 비율 |
| TC-C-006 | Twitter `summary_large_image` | curl | `grep -i 'twitter:card'` | `summary_large_image` | Twitter 카드 |
| TC-C-007 | keywords 핵심어 포함 | curl | `grep -oE '<meta name="keywords" content="[^"]+"'` | `미국 경제 지표`, `미국 기준금리`, `FOMC 일정`, `CPI 발표`, `미국 실업률`, `경제 캘린더`, `장단기 금리차`, `미국 경기침체` 8개 전부 매치 | 키워드 회귀 |
| TC-C-008 | **JSON-LD 블록 정확히 4개** | curl | `curl -s http://localhost:4200/economy \| grep -c '<script type="application/ld+json"'` | `4` (정확히) | WebPage+BreadcrumbList+Dataset+FAQPage 4종 발행 (Critical) |
| TC-C-009 | JSON-LD `@type` 검증 | curl | 4개 블록을 `python3 -c "..."` 등으로 파싱 후 `@type` 추출 | 정확히 `WebPage`, `BreadcrumbList`, `Dataset`, `FAQPage` 한 번씩 등장(순서 무관) | 스킴 정확성 (Critical) |
| TC-C-010 | BreadcrumbList 최소 항목 | curl | `itemListElement` length | ≥ 2 (홈 + 현재) | breadcrumb 정합 |
| TC-C-011 | **WebPage JSON-LD에 `dateModified` 부재** | curl | WebPage 블록 JSON 파싱 후 `'dateModified' in obj` | `false` | SITE_BUILD_DATE 고정값으로 인한 24h ISR 부정합 회피 (Critical) |
| TC-C-012 | WebPage `inLanguage = ko` | curl | WebPage 블록 파싱 | `obj.inLanguage === 'ko'` | i18n 정합 |
| TC-C-013 | WebPage `@id`는 `#webpage` 앵커 | curl | WebPage 블록 | `@id === 'https://siglens.io/economy#webpage'` | 그래프 ID 안정 |
| TC-C-014 | Dataset `variableMeasured` 포함 | curl | Dataset 블록 파싱 | `variableMeasured`에 `9종 + 국채금리 2종` 등 카운트 문자열 매치 | 정적 카운트가 레지스트리와 동기 |
| TC-C-015 | Dataset `temporalCoverage = P1Y` | curl | Dataset 블록 | `P1Y` 정확 일치 | 1년 lookback ISO8601 |
| TC-C-016 | Dataset `creator.name` | curl | Dataset 블록 | `creator.@type === 'Organization'`, `name === 'Siglens'` (SITE_NAME) | provenance |
| TC-C-017 | FAQPage `mainEntity.length === 4` | curl | FAQPage 블록 파싱 | `mainEntity.length === 4` (2s10s, FOMC, CPI, 데이터 출처) | FAQ 카운트 회귀 |
| TC-C-018 | FAQPage 각 Question `name`/`acceptedAnswer.text` 존재 | curl | mainEntity 순회 | 모든 항목 `name` + `acceptedAnswer.text` non-empty | rich snippet 자격 |
| TC-C-019 | FAQ 답변에 REVALIDATE 시간 명시 | curl | "이 데이터는 어디서 가져오나요?" 항목 텍스트 | `24시간마다` 포함(REVALIDATE_HOURS=24) | 사용자 신뢰 |

### (D) ISR / Cache Behavior

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-D-001 | Cold-gen은 throw 없음 | both | 빌드 직후 1회 요청 `curl -sI http://localhost:4200/economy` | 200, `x-nextjs-cache` 헤더 존재. 서버 stderr에 `DYNAMIC_SERVER_USAGE` 없음 | ISR cold-gen에서 dynamic API 호출 회귀 |
| TC-D-002 | 두 번째 요청 HIT | curl | TC-D-001 직후 재요청 | `x-nextjs-cache: HIT` | ISR 캐시 작동 |
| TC-D-003 | 빌드 로그 ISR 마커 | bash | `grep -E '○ */economy ' /tmp/build-pr603.log` | `○ /economy 1d 1y` (revalidate=86400 리터럴) | route segment config 리터럴 강제 (Critical) |
| TC-D-004 | ETag/Last-Modified 새너티 | curl | `curl -sI \| grep -iE '^(etag\|last-modified):'` | 최소 한 가지 존재 | 조건부 요청 가능성 |
| TC-D-005 | 시간버킷 단일 | bash + redis | 같은 시각 두 번 요청 후 `redis-cli --scan --pattern '*economy-briefing-peek-static*'` | `economy-briefing-peek-static:YYYY-MM-DDTHH` 한 종류만 | 시간버킷 회귀 |
| TC-D-006 | revalidate 값 = 86400 | bash | `grep -E '^export const revalidate' src/app/economy/page.tsx` | `export const revalidate = 86400;` (리터럴, 식/상수 금지) | MISTAKES.md §15 예외 준수 |

### (E) Indicator Grid (Data Integrity)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-E-001 | 9종 지표 + 채권 2종 + 스프레드 1종 = 최대 12 카드 SSR | both | `Array.from(document.querySelectorAll('[data-card-id]'))` 길이 | 정상 경로에서 최대 12, 부분 누락은 그 카드만 사라짐 | 카드 단위 graceful |
| TC-E-002 | 카드 라벨/단위/툴팁 = 레지스트리 일치 | chrome | 카드 dataset id ↔ `src/shared/config/economyIndicators.ts` | 모든 항목 레지스트리 값과 일치 | 레지스트리 ↔ 렌더 정합 |
| TC-E-003 | 델타 부호별 색상 | chrome | `getComputedStyle(el).color` | 양수 → `--color-ui-success`, 음수 → `--color-ui-danger` | Tailwind ui-* 토큰 매핑 |
| TC-E-004 | sub-precision 델타 텍스트 치환 | curl | `grep -F '전기 대비 변화 없음'` | 해당 케이스 있으면 매치 / 없으면 보고에 명기 | `parseFloat(toFixed(p)) === 0` 분기 |
| TC-E-005 | 2s10s 스프레드 카드 존재 | curl | `grep -F '2s10s 스프레드'` | 매치 1건 | 파생 카드 누락 회귀 |
| TC-E-006 | 2s10s 부호별 색 토큰 | chrome | 스프레드 카드 클래스 또는 computed color | 값 ≥ 0 → `text-ui-success`, < 0 → `text-ui-danger` | 0은 양수 분기 |
| TC-E-007 | 채권 2년/10년 카드 라벨 | curl | `grep -E '2년물 국채\|10년물 국채'` | 둘 다 매치 | 라벨 회귀 |
| TC-E-008 | 카드 정렬 순서 | chrome | `document.querySelectorAll('section[aria-labelledby*="indicator"] [data-card-id]')` 순서 | 레지스트리 정의 순서(금리→물가→성장·경기→고용) | 정렬 회귀 |
| TC-E-009 | 부분 누락 카드는 그 카드만 사라짐 | manual + chrome | 한 지표만 빈 응답 환경 (수동 mock 또는 1지표 누락 케이스 발생 시) | 해당 카드 미렌더, 페이지 200, 콘솔 에러 0 | 부분 실패 격리 |

### (F) Calendar (US events, ET sub-label, ISO with ET offset)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-F-001 | 캘린더 행 모두 US | chrome | `Array.from(document.querySelectorAll('[data-calendar-row]')).map(r => r.dataset.country)` | 모든 항목 `US` 또는 `미국` | 국가 필터 회귀 |
| TC-F-002 | 빈 캘린더 안내 문구 | curl | (빈 응답) `grep -F '다가오는 미국 경제 발표 일정이 아직 없어요.'` | 일정 0건이면 매치 | 빈 상태 카피 |
| TC-F-003 | 날짜 오름차순 | chrome | `Array.from(document.querySelectorAll('time[datetime]')).map(t => t.dateTime)` | sorted 결과 = 원본 | 정렬 회귀 |
| TC-F-004 | impact 배지 i18n | chrome | impact 셀 textContent ↔ data-attr | High→`높음`, Medium→`보통`, Low→`낮음` | i18n 매핑 |
| TC-F-005 | 천 단위 콤마 (ko-KR) | chrome | 숫자 셀 textContent | `/^-?[\d,]+(\.\d+)?$/`, `Intl.NumberFormat('ko-KR')` 결과 일치 | NumberFormat 회귀 |
| TC-F-006 | `<time datetime>` 기본 패턴 | chrome | 모든 `<time>` `.dateTime` | `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/` | 공백→T 정규화 |
| TC-F-007 | **캘린더 h2에 `(미 동부시간)` sub-label** | both | curl HTML에서 `grep -F '(미 동부시간)'` 또는 Chrome `document.querySelector('#economy-calendar-heading').textContent` | `경제 캘린더 (미 동부시간)` 포함, sub-label은 `text-sm font-normal` 토큰 클래스 | h2 sub-label 회귀 (Critical) |
| TC-F-008 | **`<time datetime>`에 ET offset 부여** | both | `Array.from(document.querySelectorAll('time[datetime]')).every(t => /(-04:00\|-05:00)$/.test(t.dateTime))` | `true` (모든 datetime이 EDT `-04:00` 또는 EST `-05:00`로 끝남) | DST-aware ET offset (Critical) |
| TC-F-009 | **DST 경계 정합 (offset 분포)** | chrome | 위 결과의 unique offset set | 검증 시점이 DST 활성기(3월 2주~11월 1주)면 `{-04:00}`, 비활성기면 `{-05:00}` 단일. DST 전환 주에는 두 값 공존 가능 | DST 경계 회귀 |
| TC-F-010 | sub-label 가독성 (a11y) | chrome | sub-label `<span>` `getComputedStyle().fontSize`, `color` | fontSize ≥ 14px, color contrast(text-secondary-400) WCAG AA 통과 | 작은 글씨가 읽힐 수 있어야 함 |
| TC-F-011 | sub-label은 같은 h2 안 inline | chrome | `document.querySelector('#economy-calendar-heading > span')` | 존재, parent.tagName === 'H2' | sub-label이 별도 헤딩으로 분리되지 않음 |

### (G) Briefing Client Flow (submit → poll → done/error/bot)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-G-001 | 초기 SSR 스켈레톤 | curl | `grep -E 'aria-busy="true"[^>]*aria-label="거시 경제 브리핑 로딩 중"'` | 매치 존재 | 마운트 전 a11y 스켈레톤 |
| TC-G-002 | 마운트 직후 submit 1회 | chrome | navigate → 1s 후 `read_network_requests` | `submitMacroBriefingAction` RSC 요청 1건 (마운트 당 1회) | 자동 submit + dedup |
| TC-G-003 | 정상 경로 polling 종료 | chrome | navigate 후 최대 60s 대기, regime 배지 텍스트 확인 | 배지 텍스트 `확장\|둔화\|수축\|회복\|중립` 중 하나, `bg-ui-*/20 text-ui-*` 토큰 클래스 쌍 존재 | poll→done 분기 (Critical) |
| TC-G-004 | WORKER 누락 시 에러 알림 | both | WORKER_* 미설정 재기동 → navigate → 60s 후 DOM 확인 | `[role="alert"]` 존재, textContent에 `지금은 거시 브리핑을 만들지 못했어요. 잠시 후 다시 시도해 주세요.` 포함 | 디그레이드 카피 회귀 |
| TC-G-005 | 폴링 주기 5초 | chrome | navigate 후 20s 모니터 | `pollMacroBriefingAction` 호출 간격 평균 ~5s (±1s) | 폴링 주기 회귀 |
| TC-G-006 | 콘솔 error 0건 | chrome | navigate 후 60s 대기 → `read_console_messages` | `error` 레벨 0건 (의도적 WORKER 미설정 케이스는 별도 보고) | 클라 안정성 (Critical) |
| TC-G-007 | regime 색 토큰 매핑 | chrome | regime 배지 `getComputedStyle` | success/warning/danger 토큰 한 쌍, 텍스트와 의미 일치 | 토큰 매핑 |
| TC-G-RL-001 | **서버사이드 rate-limit 부재 확인 (intentional)** | code review | `grep -F 'rate-limit' src/entities/economy/actions/submitMacroBriefingAction.ts` | JSDoc에 known risk 명시(`서버사이드 rate-limit 없음 (known risk, documented)`), 실제 enforcement 코드 없음 | known risk가 문서화만 되어 있음을 확인(기능 검증 X) |

### (H) Degrade Path (`E2E_ECONOMY_FORCE_EMPTY=1`)

이 그룹은 환경변수로 **재기동 후** 실행한다.

```bash
E2E_ECONOMY_FORCE_EMPTY=1 NEXT_PUBLIC_FAKE_DATA_ALLOWED=1 NODE_ENV=production yarn start
```

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-H-001 | 디그레이드 시 200 유지 | curl | `curl -sI http://localhost:4200/economy` | `200` (5xx 아님) | EmptyProvider 경로에서 페이지 살아있음 (Critical) |
| TC-H-002 | **디그레이드 메타 `robots: noindex, follow:true`** | curl | `curl -s http://localhost:4200/economy \| grep -i 'name="robots"'` | content에 `noindex` 포함, `nofollow` **미포함**(= `follow: true`) | 빈 페이지 SEO 회피 + 링크 주스 보존 (Critical) |
| TC-H-003 | **디그레이드 canonical은 null (미발행)** | curl | `grep -i 'rel="canonical"'` | 매치 0건 (canonical 태그 미발행) | 임시 상태 색인 회피 (Critical) |
| TC-H-004 | EconomyDegraded 카드 카피 | curl | `grep -F '잠시 후 다시 시도해 주세요'` | 매치 존재 | 디그레이드 UI |
| TC-H-005 | 디그레이드도 h1 보존 | curl | `grep -F '미국 경제 — 지표·캘린더 한눈에'` | 매치 존재 | h1은 정상/디그레이드 동일 (Critical) |
| TC-H-006 | 디그레이드 JSON-LD 생략 또는 최소 | curl | JSON-LD 블록 카운트 | 0 또는 BreadcrumbList만 1 — 정상의 4개와 다름 | noindex와 LD 발행 정합 |
| TC-H-007 | 디그레이드 후 redis 키 미생성 | bash | `redis-cli --scan --pattern '*economy-snapshot-static*'` | 0건 | `shouldCacheEconomySnapshot=false` 가드 작동 |
| TC-H-008 | EmptyProvider env 게이트 | bash | `NEXT_PUBLIC_FAKE_DATA_ALLOWED` 빈 값으로 재기동 후 같은 요청 | 정상 경로로 fallback(FMP 실패 시는 정상 빈 응답 경로), EmptyProvider 미작동 | env seam 안전장치 |
| TC-H-009 | 디그레이드 시 briefing skeleton 미렌더 | curl | `grep -E 'aria-busy="true"'` | 매치 0건 또는 1건 미만 | degraded는 briefing 차단 |

### (I) NEW — M3 Quorum Cache (5/9 vs 6/9 vs all-empty 경계)

테스트 방식: `src/entities/economy/__tests__/economySnapshotCache.test.ts`의 quorum 시나리오를 **prod build에서 재현**한다. mock provider 또는 임시 patch로 populatedCount를 변형해 다음 케이스를 만든다. (간단히는 vitest 단위 테스트가 통과함을 확인하고, 추가로 prod에서 redis 키 발생 여부를 실측 검증.)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-I-001 | **5/9 populated + treasury → 캐시 안 됨** | bash + redis | mock provider(5개 지표만 latest 값, treasury 존재, calendar 비어있음)로 1회 요청 → redis 키 확인 | redis에 `economy-snapshot-static*` 키 **0건**. 페이지 자체는 200 (Critical) | shouldCacheEconomySnapshot quorum 하한 |
| TC-I-002 | 5/9 populated 빌드 로그 | bash | 서버 stderr | "skipped cache" 또는 silent. 명시적 로그 없을 수 있음 → 보고에 명기 | observability |
| TC-I-003 | **6/9 populated + treasury → 캐시 됨** | bash + redis | mock provider(6개 지표 latest, treasury 존재) → 1회 요청 → redis 키 확인 | redis에 `economy-snapshot-static*` 키 **1건**(시간버킷) (Critical) | quorum 통과 캐시 |
| TC-I-004 | **6/9 populated + treasury=null + calendar=[] → 캐시 안 됨** | bash + redis | 6개 지표 latest 있지만 treasury/calendar 모두 비어있음 | redis 키 0건 | `hasTreasuryOrCalendar` 보조 가드 (Critical) |
| TC-I-005 | 9/9 populated → 캐시 됨 | bash + redis | 정상 경로 | redis 키 1건 | 정상 quorum |
| TC-I-006 | 0/9 + treasury null + calendar [] → degrade | bash | EmptyEconomyProvider 경로 | `isEmptyEconomySnapshot=true` → degrade UI, redis 키 0건 | TC-H 그룹과 일관 |
| TC-I-007 | 1/9 populated (renders) but cache skipped | bash + redis | 1개 지표 latest, 나머지 null, treasury null, calendar [] | 페이지 렌더(degrade 아님, noindex 아님), redis 키 0건 | renders ↔ caches 비대칭 asymmetry 검증 (가장 미묘한 케이스) |
| TC-I-008 | quorum 단일 카테고리 전멸 보호 | bash | labor 3종 전부 null, 나머지 6종 populated | populatedCount=6, treasury 있으면 캐시 됨. 보고에 카테고리 누락 여부 함께 기록 | 단일 카테고리 누락 시에도 quorum이 캐시 허용 |

### (I-Bot) Bot Path

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-I-101 | Googlebot UA 200 | curl | `curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:4200/economy` | `200`, `content-type: text/html` | 봇 응답 정상 |
| TC-I-102 | 봇은 briefing 미생성 카피 | chrome | UA Googlebot 오버라이드 → navigate, 60s 대기 → DOM | 브리핑 영역에 `크롤러 접근으로 분석을 생성하지 않았어요.` 포함, `[role="alert"]` 없음 | `isBot` 분기 |
| TC-I-103 | 봇 경로 JSON-LD 4블록 유지 | curl | TC-I-101 응답 본문 | 4 블록 유지 (WebPage, BreadcrumbList, Dataset, FAQPage) | 봇 SEO 데이터 |
| TC-I-104 | 봇 경로 canonical 유지 | curl | 위 응답 canonical | `https://siglens.io/economy` | 봇 canonical 일관 |
| TC-I-105 | 봇은 polling 0건 | chrome | UA Googlebot, 30s 모니터 | `pollMacroBriefingAction` 요청 0건 | 봇 트래픽 절감 |
| TC-I-106 | 봇 경로 캘린더 sub-label 동일 | curl | TC-I-101 본문에서 `grep -F '(미 동부시간)'` | 매치 존재 | 봇 SSR HTML 일관 |

### (J) NEW — A11y Deep Check

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-J-001 | **단일 h1** | chrome | `document.querySelectorAll('h1').length` | `1` (정확히) | a11y heading uniqueness (Critical) |
| TC-J-002 | **heading hierarchy 일관 (h1 → h2 → h3)** | chrome | `Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => +h.tagName[1])` | 첫 항목 1, 이후 단조 비감소 또는 한 단계 감소 — h1 다음 바로 h3/h4 없음 | heading skip 회귀 |
| TC-J-003 | ARIA landmarks 존재 | chrome | `document.querySelector('main')`, `document.querySelectorAll('section[aria-labelledby]')` | `main` 1개, section 3개 (지표/캘린더/브리핑) | 랜드마크 a11y |
| TC-J-004 | aria-labelledby가 실제 id를 가리킴 | chrome | section의 `aria-labelledby`로 `getElementById` 호출 | 모든 참조가 non-null 헤딩 노드 | aria 참조 정합 |
| TC-J-005 | **캘린더 sub-label 읽힘 (스크린리더 친화)** | chrome | `#economy-calendar-heading` textContent | `경제 캘린더 (미 동부시간)` 전체가 한 h2 accessibility name에 포함 | sub-label은 별도 노드 아니라 h2의 일부로 노출 (Critical) |
| TC-J-006 | sub-label color contrast WCAG AA | chrome | `getComputedStyle(span).color` vs 배경 색 | 대비 ≥ 4.5:1 (text-secondary-400 on bg-secondary-900 token combo) | 디자인 토큰 검증 |
| TC-J-007 | aria-busy 스켈레톤 hydration 후 false | chrome | navigate, 60s 후 `document.querySelector('[aria-busy]').getAttribute('aria-busy')` | `false` 또는 요소 제거 | hydration 정합 |
| TC-J-008 | 키보드 포커스 순서 | chrome | Tab 키 순회 시 focus ring (`outline` non-none) | h1 이후 첫 인터랙티브 요소부터 시각적 표시. focus trap 없음 | 키보드 a11y |
| TC-J-009 | role=alert는 dynamic content 한정 | chrome | `document.querySelectorAll('[role="alert"]')` | 정상 경로 0건, 디그레이드/워커 누락 경로 1건 | alert 남용 회피 |
| TC-J-010 | `<time>` 요소 텍스트가 사람이 읽을 수 있음 | chrome | `Array.from(document.querySelectorAll('time')).map(t => t.textContent)` | 비어있지 않음, `datetime` 속성과 별개로 인간 가독 텍스트 존재 | sr-only 회귀 |

### (K) Performance & Resource Sanity (기존 (J) 보존)

| ID | Title | Method | Steps | Expected | Why |
|---|---|---|---|---|---|
| TC-K-001 | HTML 페이로드 합리적 | curl | `curl -s -o /tmp/economy.html http://localhost:4200/economy; wc -c /tmp/economy.html` | < 500 KB (gzip 전) | RSC payload 폭증 회귀 |
| TC-K-002 | 초기 JS 청크 수 | chrome | navigate 후 `.js` 응답 카운트 | ≤ 20 | 번들 분할 회귀 |
| TC-K-003 | 폰트/이미지 요청 수 | chrome | `font\|image` 분류 카운트 | font ≤ 4, image ≤ 5 | LCP 자원 누수 |
| TC-K-004 | 콘솔 warning ≤ 임계 | chrome | navigate 후 60s → `read_console_messages` | `warning` 레벨 ≤ 2 (dev-only 경고 제외) | 신규 warning 보고 |
| TC-K-005 | LCP 후보 식별 | chrome | `PerformanceObserver`로 LCP 요소 추출 | LCP 요소가 h1 또는 첫 카드 | LCP 회귀 |
| TC-K-006 | 네트워크 4xx/5xx 0 | chrome | 30s 모니터 | 모든 응답 < 400 | silent error 감지 |
| TC-K-007 | redis MISS→HIT 전이 | curl | 첫 요청 → 둘째 요청 `x-nextjs-cache` | 둘째에서 `HIT` | ISR hit-rate |

---

## 5. 보고 (Reporting) — Post-Test Reporting Template

각 TC 실행 후 다음 형식으로 결과 보고. 모든 결과를 종합해 **머지 권고**(Merge Recommendation)를 도출한다.

### 5.1 TC별 결과 (반드시 모든 ID 등재)

```
TC-A-001  PASS  http=200 ct=text/html
TC-A-002  PASS  HEAD 200, body 없음
...
TC-C-008  PASS  JSON-LD 블록 수=4
TC-C-009  PASS  WebPage/BreadcrumbList/Dataset/FAQPage 각 1회
TC-C-011  PASS  dateModified 부재 확인
TC-F-007  PASS  h2 textContent="경제 캘린더 (미 동부시간)"
TC-F-008  PASS  모든 datetime에 -04:00 또는 -05:00 suffix
TC-I-001  PASS  5/9 populated, redis 키 0건
TC-I-003  PASS  6/9 populated, redis 키 1건
TC-I-004  PASS  6/9 + null treasury + [] calendar, redis 키 0건
TC-H-002  PASS  noindex 포함, nofollow 미포함
TC-H-003  PASS  canonical 태그 미발행
...
TC-E-009  N/A   누락 카드 케이스 본 런에서 발생 안 함
TC-K-002  FAIL  .js 응답 25개 (임계 20 초과) — 신규 청크 추적 필요
```

### 5.2 그룹별 합계 요약

```
Group A (Response & Status)        : PASS x/6  FAIL x  N/A x
Group B (SSR HTML & SEO basics)    : PASS x/10 FAIL x  N/A x
Group C (Metadata & JSON-LD)       : PASS x/19 FAIL x  N/A x
Group D (ISR / Cache Behavior)     : PASS x/6  FAIL x  N/A x
Group E (Indicator Grid)           : PASS x/9  FAIL x  N/A x
Group F (Calendar)                 : PASS x/11 FAIL x  N/A x
Group G (Briefing Client Flow)     : PASS x/8  FAIL x  N/A x
Group H (Degrade Path)             : PASS x/9  FAIL x  N/A x
Group I (Quorum Cache)             : PASS x/8  FAIL x  N/A x
Group I-Bot (Bot Path)             : PASS x/6  FAIL x  N/A x
Group J (A11y Deep Check)          : PASS x/10 FAIL x  N/A x
Group K (Performance & Resource)   : PASS x/7  FAIL x  N/A x
─────────────────────────────────────────────────────────────
TOTAL                              : PASS x/109 FAIL x N/A x
```

### 5.3 발견된 리스크 분류 (3 categories)

#### 🟢 None — 영향 없음
- (예: 특정 TC가 환경 미충족으로 N/A 처리됐으나 코드 자체에는 무관)

#### 🟡 Minor — 머지 가능 + follow-up
- (예: TC-K-004 콘솔 warning 1건, Next dev-mode 잔재)
- (예: TC-D-005 시간버킷 키 외 무관 키 1개 발견 → 별도 이슈)

#### 🔴 Blocker — 머지 차단
- (예: TC-C-008 JSON-LD 블록 3개 발견 — FAQPage 누락)
- (예: TC-I-003 6/9 populated인데 redis 키 미생성 → quorum 회귀)
- (예: TC-F-008 datetime에 offset 누락 → DST aware 정규화 실패)

### 5.4 회귀(Regression) 보고

직전 PR(#600) 검증에서 PASS했던 항목이 #603에서 FAIL한 경우 다음 형식으로 별도 보고:

```
REGRESSION: TC-XXX-YYY
  - 직전 PR #600 결과: PASS
  - 현재 PR #603 결과: FAIL
  - 회귀 원인 추정: <변경 파일/커밋 SHA>
  - 시스템적 원인: <왜 회귀가 재발했는지>
```

⚠️ 회귀가 1건이라도 발견되면 **머지 전 사용자에게 먼저 보고**한다 (silent repair 금지).

### 5.5 머지 권고 (Merge Recommendation)

다음 중 하나로 결론:

- ✅ **APPROVE — 머지 가능**
  - Critical/Blocker 0건
  - Major FAIL 0건 또는 사용자 합의된 follow-up
  - 회귀 0건
  - 머지 후 follow-up 이슈 N건 (Minor 정리)

- ⚠️ **CONDITIONAL APPROVE — 조건부 머지**
  - Critical/Blocker 0건
  - Major FAIL 있으나 사용자에게 보고 후 동의 시 머지
  - follow-up 이슈 필수 N건

- 🛑 **BLOCK — 머지 차단**
  - Critical/Blocker ≥ 1건
  - 또는 회귀 ≥ 1건
  - 수정 후 본 스펙 재실행 필요

### 5.6 보고 헤더 메타데이터

```
검증 일시      : YYYY-MM-DD HH:mm (KST)
브랜치         : feat/economy-page-followup
빌드 SHA       : <git rev-parse HEAD>
core 버전      : <yarn why @y0ngha/siglens-core 결과>
실행 env       : 정상 / 디그레이드 (각각 분리 기록)
redis          : 있음/없음
WORKER         : 있음/없음
검증자         : <user>
```

---

## 6. 보충 — 변경 델타 ↔ TC 매핑

PR #603에서 도입/변경된 항목과 검증 TC의 1:1 매핑:

| 변경 항목 | 검증 TC |
|---|---|
| `shouldCacheEconomySnapshot` quorum (≥6/9 + treasury OR calendar) | TC-I-001, TC-I-003, TC-I-004, TC-I-005, TC-I-007 |
| `isEmptyEconomySnapshot` asymmetry (전 축 null만 degrade) | TC-I-006, TC-I-007, TC-H-001, TC-H-005 |
| WebPage JSON-LD에서 `dateModified` 제거 | TC-C-011, TC-C-012, TC-C-013 |
| 캘린더 h2 `(미 동부시간)` sub-label | TC-F-007, TC-F-010, TC-F-011, TC-J-005 |
| `EmptyEconomyProvider` env seam (`E2E_ECONOMY_FORCE_EMPTY=1`) | TC-H-001~009 |
| `submitMacroBriefingAction` rate-limit JSDoc(미구현, known risk) | TC-G-RL-001 |
| ET timezone offset on `<time datetime>` (DST-aware) | TC-F-008, TC-F-009 |
| JSON-LD 4블록 (WebPage+BreadcrumbList+Dataset+FAQPage) | TC-C-008, TC-C-009, TC-C-014~019, TC-I-103 |
| Degrade canonical:null + follow:true | TC-H-002, TC-H-003 |

---

## 7. 비고 (Notes)

- TC-I-* (Quorum) 그룹은 prod build에서 데이터 mock이 어려우므로, **vitest 단위 테스트 통과 + prod에서 캐시 키 발생 여부 실측**의 2단계로 진행한다. 데이터 mock이 prod에서 어려우면 보고에 "vitest 단위 PASS, prod 실측은 정상 경로 9/9만 확인" 식으로 명기.
- TC-F-009 (DST 경계) 검증 시 현재 날짜를 기록하고, DST 전환 주(3월 두번째 일요일, 11월 첫번째 일요일)에 걸쳐있는지 함께 보고한다.
- TC-G-RL-001은 기능 검증이 아니라 **JSDoc 문서화만 확인**한다. rate-limit 실제 구현은 별도 이슈.
- 모든 curl 명령은 `localhost:4200`을 가정. 다른 포트면 `PORT=4200 yarn start`로 강제.
- 디그레이드/정상 경로 전환 시 서버 재기동을 잊지 않는다(모듈 로드 시점 provider 고정 가능성).

---

끝.
