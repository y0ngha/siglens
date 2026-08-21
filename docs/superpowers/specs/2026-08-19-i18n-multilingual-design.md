# 다국어(i18n) 지원 설계 — ko / en / ja / zh

> 작성일 2026-08-19 · 브랜치 `feat/i18n-multilingual`
> 기본 언어 **한국어(ko)**, 추가 **영어(en) · 일본어(ja) · 중국어 간체(zh)**.

---

## 0. 요약 (결정 사항)

| 항목 | 결정 | 근거 |
|---|---|---|
| 라이브러리 | **next-intl 4.13.x** | Next 16 App Router 네이티브, RSC 우선(server-only ~457B), ICU MessageFormat, 타입 세이프 키. peer `next: ^16.0.0` 명시 |
| URL 전략 | `[locale]` 세그먼트 + `localePrefix: 'as-needed'` — **ko는 접두사 없음** | 이미 순위를 가진 기존 URL(`/AAPL`)이 1바이트도 안 바뀐다. 2026-07 크롤 수요 붕괴 이력이 있는 사이트에서 전 URL 이동은 금지 |
| 언어 자동 감지 | **끈다** (`localeDetection: false`) | Accept-Language 리다이렉트는 (1) CDN 캐시 키를 오염시키고 (2) 미국 IP·`en` 헤더로 크롤하는 Googlebot을 한국어 canonical에서 이탈시킨다 |
| 메시지 저장소 | `messages/{locale}.json` (최상위 키 = 네임스페이스), ko가 source-of-truth | 카탈로그는 codemod가 통째로 생성하는 산출물이라 손편집이 없다 → 병합 충돌 논거가 성립하지 않고, 파일 하나면 동적 import가 단순하다. **클라이언트 전송량은 파일 구조가 아니라 `pickMessages`로 통제** |
| 추출 방식 | Babel AST 파싱 + **텍스트 스플라이싱 codemod** | `@babel/generator` 미설치 + 전면 리포맷 회피. 최소 diff |
| 번역 생성 | 기존 LLM 프로바이더 + 용어집 주입 | 신규 SaaS 의존 0. 54,080자 × 3언어 = 1회 수 달러 |
| 번역 신뢰도 | 7종 자동 게이트 + 역번역 채점 + 민감 네임스페이스 인간 승인 | 아래 §5 |
| AI 분석 다국어 | **core 무변경 · 후처리 번역 레이어** | core는 프롬프트/캐시키 소유(SCOPE.md). 로케일 프롬프트는 분석 비용 4배 + 교차 레포 릴리스. 상세 §6 |
| SEO | 자기참조 canonical + `alternates.languages` + sitemap `xhtml:link` + **로컬라이즈 완료 게이트** | thin 번역 페이지 색인은 2026-07 재현. 준비된 로케일만 index |
| DB 콘텐츠 | 기존 테이블에 `locale` 컬럼 **추가(DEFAULT 'ko')** | 기존 행 무변경 이관 |

---

## 1. 현황 실측 (설계 근거)

`tmp/i18n/scan.mjs` (Babel AST, 주석 제외, 테스트 제외) 결과:

```
파싱 실패:            0 파일
사용자 대면 한국어:  367 파일
문자열 출현:       2,945 (JSXText 767 · StringLiteral 1,788 · Template 390)
고유 문자열:       2,297
고유 문자 총합:   54,080
```

> `grep '[가-힣]'` 기준 27,556 라인 중 **대부분이 JSDoc 주석**이라 번역 대상이 아니다.
> 실제 번역 규모는 소설 한 편 분량(54KB)이며, 기계번역 1회 비용은 수 달러 수준이다.

레이어별 상위 분포:

```
332  src/shared/lib        (라벨·에러메시지·seo.ts 1,482줄)
320  src/shared/config     (내비·카테고리 라벨)
175  src/views/symbol
169  src/app/[symbol]
136  src/widgets/analysis
131  src/widgets/fundamental
129  src/widgets/options
 90  src/widgets/dashboard
...  (전체 86개 슬라이스)
```

---

## 2. 라우트 인벤토리 (전수)

`tmp/i18n/routes.mjs`가 `src/app`을 걸어 생성한다. **CI에서 이 목록과 로케일 커버리지 테스트를 대조한다** — 새 라우트가 i18n 없이 들어오는 것을 막는 장치다.

### 2.1 페이지 32개 (모두 로케일 대상)

| # | 라우트 | ko | en | ja | zh | 비고 |
|---|---|---|---|---|---|---|
| 1 | `/` | ✅ | `/en` | `/ja` | `/zh` | 랜딩. `?q=` 검색 리다이렉트 로케일 보존 필요 |
| 2 | `/[symbol]` | ✅ | `/en/[symbol]` | … | … | 차트+AI 분석. 색인 게이트 대상 |
| 3 | `/[symbol]/congress` | ✅ | … | … | … | |
| 4 | `/[symbol]/fear-greed` | ✅ | … | … | … | |
| 5 | `/[symbol]/financials` | ✅ | … | … | … | ETF는 기존 noindex 유지 |
| 6 | `/[symbol]/fundamental` | ✅ | … | … | … | |
| 7 | `/[symbol]/news` | ✅ | … | … | … | |
| 8 | `/[symbol]/options` | ✅ | … | … | … | |
| 9 | `/[symbol]/overall` | ✅ | … | … | … | |
| 10 | `/[symbol]/position` | ✅ | … | … | … | |
| 11 | `/account` | ✅ | … | … | … | noindex(인증) |
| 12 | `/account/delete` | ✅ | … | … | … | noindex |
| 13 | `/backtesting` | ✅ | … | … | … | |
| 14 | `/economy` | ✅ | … | … | … | |
| 15 | `/economy/kr` | ✅ | … | … | … | |
| 16 | `/fear-greed` | ✅ | … | … | … | |
| 17 | `/fear-greed/kr` | ✅ | … | … | … | |
| 18 | `/forgot-password` | ✅ | … | … | … | noindex |
| 19 | `/login` | ✅ | … | … | … | noindex |
| 20 | `/market` | ✅ | … | … | … | |
| 21 | `/market/kr` | ✅ | … | … | … | |
| 22 | `/news` | ✅ | … | … | … | 3지역 상위 허브 |
| 23 | `/news/[category]` | ✅ | … | … | … | slug 6종: `general` `stock` `crypto` `forex` `articles` `kr` |
| 24 | `/news/us` | ✅ | … | … | … | |
| 25 | `/onboarding` | ✅ | … | … | … | noindex |
| 26 | `/portfolio` | ✅ | … | … | … | noindex |
| 27 | `/privacy` | ✅ | … | … | … | DB `terms` 테이블 콘텐츠 |
| 28 | `/reset-password` | ✅ | … | … | … | noindex |
| 29 | `/share/[id]` | ✅ | … | … | … | noindex. 공유 스냅샷은 **생성 시 로케일 고정** |
| 30 | `/signup` | ✅ | … | … | … | noindex |
| 31 | `/signup/oauth/consent` | ✅ | … | … | … | noindex |
| 32 | `/terms` | ✅ | … | … | … | DB `terms` 테이블 콘텐츠 |

`/news/[category]` 6 slug 전개를 포함하면 **정적 로케일 URL 37개 × 4 = 148개**,
여기에 `[symbol]` 계열(POPULAR_TICKERS 371종 × 최대 9 서브라우트)이 곱해진다.

### 2.2 Route Handler 14개 (로케일 비대상 — 단, 3개는 변경 필요)

| 라우트 | i18n 영향 |
|---|---|
| `/api/analysis/stream` | **있음** — SSE 응답에 로케일 전달, 번역 레이어 경유 |
| `/api/sitemap` (+ `/static` `/popular` `/crypto` `/longtail/[page]` `/removal/[kind]`) | **있음** — `xhtml:link` alternates 추가 |
| `/api/cron/seo-prewarm` | **있음** — 프리웜 로케일 화이트리스트 |
| `/api/auth/*`, `/api/health`, `/api/ready`, `/api/cron/kr-tickers`, `/api/sse-probe` | 없음 |

> API 라우트는 next-intl proxy matcher에서 **반드시 제외**한다. 포함되면 `/api/...`가
> `/ko/api/...`로 리라이트되어 전부 404가 된다.

### 2.3 Special 5개

`not-found.tsx` · `error.tsx` · `global-error.tsx` · `robots.ts` · `manifest.ts`

- `not-found` / `error`: 로케일 세그먼트 **밖**에서도 발생 가능 → ko 폴백 문구를 하드코딩 유지하고, `[locale]` 내부용 `not-found`를 별도로 둔다.
- `global-error`: React 트리 최상단이라 `NextIntlClientProvider` 바깥 → **번역 불가**, ko + en 병기 정적 문구.
- `manifest.ts`: `name`/`description`이 한국어. 로케일별 manifest는 PWA 사양상 1개만 링크되므로 **ko 고정**(설치 배너 언어는 v1 범위 밖).
- `robots.ts`: 변경 없음.

### 2.4 모달 · 시트 · 드로어 25개 (전부 로케일 대상)

```
features/analysis-nudge/ui/AnalysisSignupNudgeModal.tsx
features/premium-gate/ui/PremiumModelGateModal.tsx
features/pwa-install/ui/IosInstallModal.tsx
features/pwa-install/ui/PwaBanner.tsx
features/symbol-model/model/SymbolModelContext.tsx
shared/ui/GearIcon.tsx
shared/ui/PopoverSurface.tsx
views/symbol/ChartContent.tsx
views/symbol/MobileAnalysisSheet.tsx          ← vaul. 모바일 필수 경로
views/symbol/SymbolLayoutHeader.tsx
views/symbol/SymbolPageClient.tsx
widgets/chart/StockChart.tsx
widgets/chart/ui/IndicatorSettingsModal.tsx
widgets/chat/ChatPanel.tsx
widgets/chat/UserApiKeyRequiredModal.tsx
widgets/financials/FinancialsStatements.tsx
widgets/financials/financialsTooltips.tsx
widgets/financials/sections/BalanceSheetSection.tsx
widgets/financials/sections/IncomeStatementSection.tsx
widgets/layout/HeaderMobileMenu.tsx           ← 언어 스위처가 들어갈 곳
widgets/notice-popup/ui/NoticePopup.tsx       ← DB 콘텐츠
widgets/share/ui/ShareButton.tsx
widgets/share/ui/SharePreparingModal.tsx
widgets/share/ui/ShareSheet.tsx
widgets/share/ui/ShareTriggerDialog.tsx
```

> 모달은 라우트가 아니라 **소속 페이지의 로케일을 상속**한다. 별도 URL이 없으므로
> SEO 대상이 아니지만 메시지 추출 대상이며, `NextIntlClientProvider` 하위에
> 마운트되는지 확인해야 한다(`PwaBanner`·`NoticePopupLoader`는 root layout 직속이라
> 프로바이더 위치 조정 필요).

### 2.5 DB 저장 콘텐츠 (코드 밖 번역 대상)

> **2026-08-21 갱신** — 아래 표는 구현하면서 세 군데가 바뀌었다. 이유는 §2.5.1.

| 테이블 | 한국어 필드 | 처리 |
|---|---|---|
| `terms` | `body` | **사이드카** + `source='human'`만 신뢰. 번역 없으면 원문 + 안내 배너 |
| `notices` | `title` `body` `linkLabel` | **사이드카**(원본 `id` 유지 — §2.5.1) |
| `profileDescriptionTranslations` | `descriptionKo` | 사이드카. **비-ko는 FMP 원문 영어 그대로**(재번역 금지) |
| `news` / `marketNews` | AI 생성 한국어 | 사이드카(§6 후처리 번역 레이어가 채운다) |
| `economicCalendar` | 이벤트 한국어 | 사이드카 |
| `seoAnalysisSnapshots` | 프리웜된 분석 본문 | **`locale` 컬럼** + uq `(symbol, tab, locale)` |
| `sharedAnalyses` | 공유 스냅샷 본문 | **`locale` 컬럼** + `contentHash` 페이로드에 locale |
| ~~`assetTranslations`~~ | `koreanName` | **레지스트리에서 뺐다** — §2.5.1 (3) |
| ~~`economicIndicatorTranslations`~~ | `koreanName` | **레지스트리에서 뺐다** — §2.5.1 (3) |

> `seoAnalysisSnapshots`·`sharedAnalyses`도 `TRANSLATABLE_ENTITY`에는 없다.
> 사이드카를 쓰지 않으므로 등록할 이유가 없다 — 등록해 두면 백필·번역이
> 대상으로 잡는다.

#### 2.5.1 결정 변경 두 가지

**(1) 대부분은 `locale` 컬럼이 아니라 사이드카 테이블**

원안은 테이블마다 `locale` 컬럼을 더하는 것이었다. 구현하면서 뒤집었다.

- 로케일 추가가 **행 추가**로 끝난다. 컬럼 방식이면 9개 테이블에 매번
  마이그레이션이 필요하고, 그때마다 PK·unique 인덱스를 다시 설계해야 한다.
- **`notices`는 컬럼 방식이 기능을 깬다.** 공지 팝업의 "다시 보지 않기"가
  `id`를 localStorage에 저장한다. 로케일마다 별도 행(=별도 `id`)을 만들면
  한국어로 닫은 공지가 영어로 다시 뜬다. 사이드카는 원본 `id`를 유지한다.
- `sharedAnalyses`의 dedupe 충돌(아래 ⚠️)을 건드리지 않는다.

대신 원본 행과의 FK가 없다 — `entity_id`가 테이블마다 타입이 달라(uuid/text)
단일 FK를 걸 수 없다. 원본 삭제 시 고아 행이 남는다(조회 키가 안 맞아 화면에는
새어 나오지 않는다). 정리 크론은 후속 항목이다.

**(2) 예외 둘은 여전히 `locale` 컬럼** — `sharedAnalyses`·`seoAnalysisSnapshots`

이 둘의 본문은 **그 언어로 생성된 AI 산출물**이다. 사후에 다른 로케일로 다시
해석할 수 있는 성질의 값이 아니라, 로케일이 그 행의 정체성의 일부다. 사이드카에
넣으면 "번역이 없으면 폴백"이라는 사이드카의 의미론과 충돌한다.

> ⚠️ **`sharedAnalyses`의 dedupe 충돌**: `shared_analyses_content_uq`는
> `contentHash` **단독** unique이고(`src/shared/db/schema.ts`),
> `create()`는 `onConflictDoUpdate({ target: contentHash, set: { expiresAt } })`로
> 기존 행을 재사용한다. `contentHash`에 로케일이 없으면 **영어 사용자가 만든
> 공유 링크가 먼저 저장된 한국어 행의 id를 돌려받고**, `onConflictDoUpdate`는
> `expiresAt`만 갱신하므로 로케일도 고쳐지지 않는다 — 조용히 남의 언어 스냅샷을
> 공유하게 된다.
> **해결**: `contentHash` 페이로드에 `locale`을 넣는다(unique를 `(contentHash,
> locale)`로 넓히는 것보다 낫다 — 기존 인덱스·쿼리를 안 건드리고, 로케일이
> 다르면 해시가 달라져 자연히 다른 행이 된다). 기존 행의 해시는 무효가 되지만
> **공유 링크는 `id`로 조회하므로 살아 있다**.
> 회귀 가드: `entities/shared-analysis/__tests__/contentHash.test.ts`.

**(3) 종목명·지표명은 레지스트리에서 뺐다**

원안은 두 테이블도 사이드카에 얹는 것이었다. 구현하고 나서 **읽는 경로가
없다**는 것이 감사에서 드러났다 — 등록만 해 두면 백필과 AI 번역이 매번 돌면서
결과가 그대로 버려진다. 화면은 멀쩡하고 테스트도 통과하므로 눈으로는 안 잡힌다.

빼는 쪽을 골랐다. 두 경로 모두 **비-ko에서 이미 영문 원본이 나가기 때문**이다:

- `buildDisplayName`은 비-ko에서 `assetInfo.name`(영문 법인명)을 쓴다.
  한국어명은 영문명이 아예 없을 때만 나오는데, 그 자리의 대안은 맨 티커다.
  지수·ETF처럼 이름이 고정된 것은 `shared.assetName` 메시지 카탈로그가 덮는다.
- `resolveIndicatorLabels`는 비-ko에서 사전·DB를 아예 타지 않고 원본 영문
  지표명을 돌려준다. 사이드카를 붙이면 로케일마다 별도 `unstable_cache`
  엔트리가 생겨 ISR write만 늘어난다.

즉 **한국어가 새는 자리가 아니다.** 나중에 사람이 ja/zh 종목명을 넣을 값어치가
생기면 그때 다시 등록한다.

> 회귀 가드: `shared/db/__tests__/contentTranslationRegistry.test.ts`가
> `TRANSLATABLE_ENTITY`의 모든 키에 대해 백필·번역 스크립트가 아닌 **프로덕션
> 읽기 경로**가 있는지 검사한다. 없으면 CI가 막는다.

#### 2.5.2 읽기 경로 계약

모든 DB 콘텐츠가 **같은 함수 하나**를 지난다 —
`shared/db/localizeContent.ts`의 `localizeContent()`. 엔티티마다 폴백을
따로 구현하면 규칙이 갈린다(실제로 로케일을 보던 것은 뉴스 제목 하나뿐이었고
나머지는 전부 한국어를 우선했다).

```
읽기 = 원본 행(레거시 ko 컬럼)  +  content_translations 사이드카
       → pickContentLocale(폴백 체인)  →  { value, locale, isFallback }
```

- **폴백 체인**(`shared/db/contentLocale.ts`): ko→[ko,en], en→[en,ko],
  ja→[ja,en,ko], zh→[zh,en,ko]. ja/zh에 영어를 한국어보다 앞에 둔 이유는
  읽힐 확률이다.
- **빈 문자열은 없는 것으로 본다.** DB에 분석 실패로 빈 문자열이 들어간 행이
  실제로 있고, "번역됨"으로 취급하면 폴백이 막혀 빈 카드가 렌더된다.
- **`isFallback`을 함께 돌려준다.** 약관·개인정보처리방침이 이 값으로 안내
  배너를 띄운다 — 읽지 못하는 언어의 문서에 동의시키는 것은 표시 결함이 아니라
  법적 문제다(`widgets/legal/UntranslatedNotice.tsx`).
- **쿼리는 행 수와 무관하게 1회.** 카드 20장이 사이드카를 20번 조회하면 목록
  렌더가 DB 왕복 20회가 된다.
- **`field`는 `CONTENT_FIELD` 상수만 쓴다.** 컬럼이 문자열이라 오타를 컴파일러가
  못 잡고, 오타 하나면 그 필드의 번역이 조용히 없는 것으로 취급된다(폴백이 걸려
  화면은 멀쩡해 보이고 테스트도 통과한다).

#### 2.5.3 배포 순서 (마이그레이션은 아직 적용 전)

> ⛔ **운영 DB에 적용 금지 (사용자 지시, 2026-08-21).** `.env.local`이 운영 Neon을
> 가리키므로 `yarn db:*`의 기본 대상이 운영이다. 쓰기 스크립트는 원격 대상일 때
> 거부하도록 가드를 걸어 뒀다(`db/scripts/lib/dbTarget.ts`,
> `ALLOW_REMOTE_DB_WRITE=1`로만 해제). 아래 순서는 **승인 후** 절차다.

스키마와 코드는 시차를 두고 배포된다(마이그레이션이 수동 `yarn db:migrate`다).
**스키마가 먼저다.**

| # | 작업 | 상태 |
|---|---|---|
| 1 | `yarn db:migrate --until 0029_content_locale` | ⬜ 프로덕션 미적용 (로컬 Postgres 17 실증 완료) |
| 2 | 코드 배포 | ✅ 구현 완료 |
| 3 | `yarn db:migrate` (0030) | ⬜ 프로덕션 미적용 |
| 4 | `yarn db:backfill:content-locale --apply` (ko 행) | ⬜ 프로덕션 미실행 (로컬 실증 완료 — 멱등성 포함) |
| 5 | `yarn db:translate:content-locale --locale <en\|ja\|zh> --apply` | ⬜ 프로덕션 미실행 (로컬에서 스킵·집계 검증) |
| 6 | `yarn db:verify:content-locale` — 읽기 전용 점검 | ⬜ |
| 7 | `DB_CONTENT_LOCALE=1` 설정 후 재배포 | ⬜ |

> ⛔ **1과 2를 뒤집으면 안 된다.** 스위치가 꺼져 있어도 쓰기 경로는 `locale`
> 컬럼을 넣는다 — Drizzle이 스키마에 있는 컬럼을 values에서 빼도 `default`로
> 항상 INSERT에 넣기 때문이다(실측: `values({...}).toSQL()`). 이 문서의 이전
> 판은 "코드 먼저"였고, 그 전제는 틀렸다. 회귀 가드는
> `src/entities/seo-snapshot/__tests__/upsertSql.test.ts`가 **프로덕션
> repository가 만든 SQL**을 직접 검사한다.
>
> 반대 방향은 안전하다. 0029는 additive라(컬럼 추가 + 인덱스 추가, 기존 unique
> 유지) 구 코드의 `INSERT ... ON CONFLICT (symbol, tab)`이 그대로 매칭되고
> `locale`은 기본값 `ko`로 채워진다(로컬 Postgres 17로 실증).

> ⛔ **3의 위치가 좁다.** 2보다 앞서면 배포된 구 코드의 2열 `ON CONFLICT`가
> 42P10으로 죽고, 7보다 뒤면 구 unique `(symbol, tab)`가 두 번째 로케일 행을
> **23505**로 막는다(로컬 실증). 즉 3은 "코드 배포 후, 스위치 전"에만 놓인다.
>
> 이 창을 없애려고 쓰기 경로의 `ON CONFLICT` 타깃에서 **스위치 분기를 뺐다** —
> 항상 `(symbol, tab, locale)`이다. 0029가 그 인덱스를 만들고 코드는 그 뒤에
> 배포되므로 타깃은 항상 존재하고, 스위치가 꺼진 동안엔 `locale`이 언제나
> `ko`라 2열 타깃과 동작이 같다. 결과적으로 스위치는 **읽기 전용 게이트**가
> 됐고, 언제든 되돌릴 수 있다(단 3 이후 구 코드로의 롤백은 불가).

> **0030은 저널에 있다.** 예전에는 `db:migrate`가 저널 전체를 훑는다는 이유로
> 0030을 **저널에서 빼** 뒀는데, 그러면 `drizzle-kit`의 스냅샷 체인이 끊겨
> `db:generate`가 매번 0029의 DDL을 다시 뱉는다(실제로 그 상태였고
> `0029_snapshot.json`이 아예 없었다). 저널에 두고 1단계에서 `--until`로
> 멈추는 쪽이 옳다 — 스냅샷도 맞고 적용 시점도 통제된다.
> 가드: `shared/db/__tests__/scripts/migrateUntil.test.ts`.

> **4단계가 핵심이다.** 백필(4)은 `ko` 행만 만든다 — 그것만으로는 스위치를 켜도
> 폴백이 걸려 한국어가 그대로 나간다. 비-ko 행을 만드는 것은 5단계뿐이다.
> `terms`는 AI 대상에서 제외한다(오역이 곧 의무의 변경이라 읽기 경로가
> `source='human'` 행만 받는다). 종목명·지표명은 애초에 사이드카에 등록하지
> 않는다 — 비-ko는 이미 영문 원본이 나가므로 번역할 이유가 없다.

> **로컬 실증 (2026-08-21)**: `docker-compose.e2e.yml`의 Postgres 17에
> 마이그레이션 29개를 전부 적용하고 백필을 두 번 돌려 멱등성까지 확인했다.
> 폴백은 `zh` 번역이 없을 때 `en`으로 떨어지는 것까지 실제 SELECT로 확인했다.
>
> 그 과정에서 **백필 스크립트가 실행 자체가 불가능한 상태**였다는 것이 드러났다
> — `@/shared/db/client`를 import했는데 그 모듈이 끌어오는 `server-only`가 Next
> 번들러 가상 패키지라 `tsx`에서 `MODULE_NOT_FOUND`로 죽었다. 소스를 grep하는
> 테스트는 전부 통과하고 있었다. `scripts/seed-kr-listed-names.ts`와 같은 형태
> (로컬 테이블 선언 + `postgres` 드라이버)로 고쳤고, 회귀 가드도
> "무엇이 쓰여 있는가"에서 "DB 계층을 import하지 않는가"로 바꿨다.

- **OFF일 때**: 사이드카를 조회하지 않고 `locale` 컬럼도 INSERT하지 않는다 —
  마이그레이션 전과 **정확히 같은 SQL**이 나간다.
- **ON인데 마이그레이션이 안 됐으면**: `column ... does not exist`로 즉시
  실패한다(조용한 오작동보다 낫다).
- **3번을 건너뛰고 4번을 켜면**: 사이드카가 비어 폴백 — 무동작이지 오작동이 아니다.
- ⚠️ **ISR 비용**: 스위치를 켜면 뉴스 목록의 `unstable_cache` 키에 로케일이
  붙어 ISR write가 로케일 수만큼 늘어난다(`shared/cache/contentLocaleKeyPart.ts`).
  이 레포에서 ISR write는 실제 비용 항목이다 — 켜는 것은 의식적인 결정이어야 한다.

---

## 3. 라이브러리 선정

### 3.1 후보 비교

| | next-intl 4.13 | Paraglide JS | react-i18next |
|---|---|---|---|
| Next 16 App Router | 네이티브, peer `^16.0.0` | 어댑터 | 커뮤니티 |
| RSC 지원 | 1급 (server-only ~457B) | 컴파일타임(런타임 0) | 클라이언트 중심 |
| 번들(클라 메시지 포함) | ~4KB + 사용 네임스페이스 | 최소(메시지별 트리셰이킹) | 큼 |
| ICU MessageFormat | ✅ | 제한적 | 플러그인 |
| 타입 세이프 키 | ✅ | ✅(함수) | 부분 |
| 기존 `proxy.ts` 합성 | `createMiddleware` 조합 가능 | 별도 훅 필요 | 수동 |

### 3.2 결정: **next-intl**

- 이 앱은 **RSC 렌더가 지배적**이다. Paraglide의 강점(클라이언트 메시지 트리셰이킹)은
  서버에서 렌더되는 문자열에는 이득이 없고, next-intl의 server-only 비용은 이미 ~457B다.
- `src/proxy.ts`가 티커 케이스 정규화·검색 리다이렉트·인증 가드를 **이미** 하고 있어,
  로케일 미들웨어를 **직접 합성**할 수 있어야 한다. next-intl은 `createMiddleware`가
  `NextResponse`를 반환하므로 기존 로직과 순서 조립이 자유롭다.
- ICU 복수형·성별·`{count}` 포맷이 필요하다(예: "N개 신호", 일본어/중국어는 복수형 없음).
- 번들 민감도: 2026-08 first-load JS −38% 작업의 성과를 되돌리지 않기 위해
  **네임스페이스 단위 로딩**을 강제한다(§4.3).

> ⚠️ Next **16.2.12** 사용 중이다. `next/root-params`는 16.3+ 기능이므로
> **legacy `setRequestLocale(locale)` 경로를 쓴다**. 이걸 빠뜨리면 모든 로케일 페이지가
> dynamic으로 떨어져 ISR이 통째로 꺼진다 — 이 레포에서 가장 비싼 실수다.

---

## 4. 아키텍처

### 4.1 디렉터리

```
messages/
  ko.json  en.json  ja.json  zh.json   최상위 키 = 네임스페이스(FSD 슬라이스). ko가 정본
  glossary.json                        잠금 용어(로케일별)
  _meta/
    hashes.json                        ko 메시지 콘텐츠 해시 → 스테일 감지
    review/{locale}.json               역번역 점수 미달 항목(인간 검토 대기)
src/shared/i18n/
  locales.ts            Locale 타입 · 표기명 · hreflang/og/Intl 태그 · localePath/splitLocalePath
  routing.ts            defineRouting({ localePrefix:'as-needed', localeDetection:false })
  navigation.ts         createNavigation(routing) → Link/useRouter/usePathname/redirect
  request.ts            getRequestConfig
  loadMessages.ts       카탈로그 로드 + pickMessages(클라 전송량 통제)
  clientNamespaces.ts   루트 프로바이더 네임스페이스 + withChrome()
src/shared/lib/seoAlternates.ts   hreflang alternates + 자기참조 canonical
src/app/[locale]/…               기존 src/app 라우트 전부 이동
src/app/{api,robots.ts,manifest.ts,global-error.tsx,globals.css,fonts}/  로케일 비대상 잔류
scripts/i18n/
  extract.mjs      추출 codemod
  translate.mjs    LLM 번역
  verify.mjs       7종 QA 게이트
  routes.mjs       라우트 인벤토리(테스트가 소비)
```

### 4.2 라우팅

```ts
// src/shared/i18n/routing.ts
export const LOCALES = ['ko', 'en', 'ja', 'zh'] as const;
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: 'ko',
    localePrefix: 'as-needed',   // ko = 접두사 없음 → 기존 URL 불변
    localeDetection: false,      // Accept-Language 자동 리다이렉트 금지
});
```

**`localeDetection: false`인 이유**

1. 자동 리다이렉트는 `Vary: Accept-Language`를 유발하거나 쿠키 분기를 만들어
   Cloudflare 캐시 키를 오염시킨다. 이 레포는 CF 히트율을 13.8%→36.7%로 끌어올린
   작업 이력이 있고, `Vary` 때문에 URL 퍼지가 안 먹는 문제도 겪었다.
2. Googlebot은 미국 IP·`Accept-Language: en`으로 크롤한다. 자동 리다이렉트를 켜면
   한국어 canonical에서 크롤러가 이탈해 **기존 색인이 무너진다**.
3. 사용자 선택은 헤더 스위처에서 명시적으로 이뤄지고 `NEXT_LOCALE` 쿠키에 저장된다.
   쿠키는 **스위처가 발급한 경우에만** 리다이렉트 근거로 쓴다(신규 크롤 요청에는 없음).

### 4.3 `proxy.ts` 합성 (가장 위험한 지점)

기존 `proxy.ts`는 세 가지를 한다: `?q=` 검색 리다이렉트 · 티커 대문자 정규화 · 인증 가드.
여기에 로케일이 얹히면 다음 순서여야 한다.

```
1) /api, /_next, 정적 자산  → 즉시 통과 (matcher 제외)
2) pathname에서 로케일 접두사 분리 → { locale, rest }
3) 기존 로직을 rest 기준으로 수행 (리다이렉트 URL은 locale 접두사를 다시 붙여 발급)
4) next-intl createMiddleware로 위임
```

**필수 회귀 방지**: `RESERVED_FIRST_SEGMENTS`에 `'en' | 'ja' | 'zh'`를 추가한다.
누락하면 `isAdmissibleSymbolShape('en')`이 참이라 `/en`이 `/EN` 티커로 301된다 —
빌드에서는 정상으로 보이고 런타임에서만 깨지는, 이 파일 JSDoc이 이미 경고한 함정이다.
`src/app/__tests__/proxy.test.ts`가 디렉터리 목록과 대조하므로 **로케일 목록도 대조에 포함**한다.

### 4.4 메시지 네임스페이스

- 네임스페이스 = FSD 슬라이스 경로. 예 `widgets.analysis`, `app.symbol`, `shared.lib`.
- 키 = `<파일 basename>.<의미 슬러그>`. 예 `widgets.analysis` 안의 `AnalysisPanel.emptyState`.
- 서버 렌더는 전체 카탈로그를 봐도 비용이 없다(번들에 안 실린다).
  **클라이언트로 나가는 양만** `pickMessages`로 통제한다 — 2,297키 전체를 보내면
  first-load JS 회귀다.
- 루트 레이아웃은 `ROOT_CLIENT_NAMESPACES`(헤더·푸터·전역 모달)만 주입한다.
  페이지가 더 필요하면 `withChrome('widgets.analysis', …)`로 **루트 것을 포함해**
  자체 프로바이더를 만든다 — 중첩 `NextIntlClientProvider`는 부모 `messages`를
  상속하지 않고 **교체**하므로, 루트 네임스페이스를 빼면 그 페이지 안의 헤더 문구만
  키 문자열로 노출된다.

### 4.5 포맷팅

- 숫자·날짜·상대시간은 `useFormatter()`(Intl 래퍼)로 통일.
- **통화는 UI 로케일을 따르지 않는다.** 종목의 자산군이 통화를 정한다(KRX=₩, US=$).
  UI를 en으로 바꿨다고 삼성전자 가격이 달러가 되면 안 된다 — 2026-08 3자산군 개편에서
  실제로 발생했던 결함(`₩→$`)의 재현 경로다. `priceFormat.ts`에 로케일 인자를
  **추가하지 않는다**(포맷 구분자만 로케일을 따른다).
- 기존 `formatKoreanDateTime.ts` 등 ko 전용 포맷터는 로케일 인자를 받는 범용으로 승격.

---

## 5. 번역 파이프라인과 신뢰도 검증

### 5.1 추출 (`yarn i18n:extract [--apply] [--only <경로>]`)

Babel로 파싱 → 한국어를 담은 `StringLiteral` / `JSXText` / `TemplateLiteral`을 찾아
**원본 텍스트를 start/end 오프셋으로 치환**한다(제너레이터 미사용 → 포맷 보존, 최소 diff).
치환은 오프셋 역순으로 적용해 앞선 치환이 뒤 오프셋을 밀지 않게 한다.

**키 규칙**: `<네임스페이스>.<파일 basename>.<ko 원문 sha1 6자>`.
순번 키(`Footer.1`)는 문자열이 하나 삽입되면 뒤가 전부 밀려 카탈로그 diff가 통째로
뒤집힌다. 해시는 원문이 같으면 항상 같은 키라 재추출이 멱등이다.

> ⚠️ **카탈로그는 반드시 중첩 JSON이어야 한다.** next-intl은 네임스페이스와 키를
> 항상 `.`로 쪼개 객체를 타고 내려가므로 `{"widgets.layout": {...}}` 같은 평면 키는
> 절대 매칭되지 않는다 — 첫 빌드에서 `MISSING_MESSAGE: widgets.layout`으로 드러났다.
> `pickMessages`도 같은 규칙으로 서브트리를 되쌓는다.

**자동 치환은 안전한 컨텍스트에서만** 한다. 나머지는 사유와 함께
`messages/_meta/skips.json`에 적재된다(실측):

| 사유 | 건수 | 왜 자동화하지 않는가 |
|---|---|---|
| 자동 치환 가능 | **1,151** | — |
| `non-component-module` | 1,129 | `.ts` 상수·유틸. 소비자 쪽 리팩터가 필요하다 |
| `module-scope-or-helper` | 550 | 모듈 스코프 상수·헬퍼 함수. 훅을 부를 자리가 없다 |
| `template-needs-icu-review` | 99 | 표현식 슬롯을 ICU 인자로 바꾸면 문장 구조가 달라진다 |
| `module-specifier` | 11 | import 경로·타입 리터럴. 번역 대상이 아니다 |

번역자 바인딩은 컴포넌트의 async 여부로 갈린다. `useTranslations`는 **서버
컴포넌트에서도 동작하므로**(next-intl `react-server` 진입점) 동기 컴포넌트는
클라이언트/서버 구분 없이 같은 훅을 쓴다. `getTranslations`는 훅을 부를 수 없는
async 컴포넌트에서만 필요하다.

제외 규칙(자동): `__tests__` / `*.test.*` / `*.spec.*` / `__integration__` /
`src/app/api/` / `test-utils`. 주석은 파서가 문자열로 보지 않으므로 자동 제외된다.
core로 넘어가는 프롬프트 문자열(`AI_SYSTEM_PROMPT` 등)은 core 소유라 대상이 아니다.

### 5.2 번역 (`yarn i18n:translate --locale en`)

- 기존 LLM 프로바이더 SDK 재사용(신규 SaaS 의존 0).
- 프롬프트에 **용어집(`messages/glossary.json`)과 도메인 컨텍스트**를 주입한다.
  용어집 예:

  ```json
  {
    "공포·탐욕 지수": { "en": "Fear & Greed Index", "ja": "恐怖・強欲指数", "zh": "恐惧与贪婪指数" },
    "이동평균":       { "en": "Moving Average",     "ja": "移動平均線",     "zh": "移动平均线" },
    "종합 결론":       { "en": "Overall Conclusion",  "ja": "総合結論",       "zh": "综合结论" },
    "손절":           { "en": "Stop Loss",          "ja": "損切り",         "zh": "止损" }
  }
  ```
- ICU 플레이스홀더(`{count}`, `{symbol}`)는 **번역 금지 토큰**으로 명시.
- 변경분만 번역: `messages/_meta/hashes.json`의 ko 해시가 바뀐 키만 재번역.

### 5.3 검증 게이트 (`yarn i18n:verify` — CI 필수)

| # | 게이트 | 잡는 결함 |
|---|---|---|
| 1 | **키 패리티** | ko에 있는 키가 타 로케일에 없음 / 고아 키 |
| 2 | **플레이스홀더 패리티** | `{count}` 누락·오타 → 런타임 크래시 |
| 3 | **용어집 준수** | 잠금 용어가 다른 말로 번역됨 |
| 4 | **한글 잔존 검사** | 비-ko 카탈로그에 한글 → 미번역 통과 |
| 5 | **스크립트 검사** | ja에 가나/한자 없음, zh에 가나 있음(일본어가 중국어 칸에 들어감), en이 비-ASCII 지배 |
| 6 | **길이 상식** | 원문 대비 0.4×–3× 이탈 → 잘림 또는 환각 장문 |
| 7 | **역번역 채점** | target→ko 역번역을 2차 모델이 1–5점 채점, **4점 미만은 `_meta/review/{locale}.json`으로 격리** |

게이트 1–6은 결정적(모델 호출 없음)이라 CI에서 항상 돈다.
게이트 7은 **변경된 키에 대해서만** 돌고, 결과는 커밋되는 파일이라 재실행 없이 리뷰 가능하다.

### 5.4 인간 승인 필수 네임스페이스

`scripts/i18n/review-required.json`에 등록된 네임스페이스는 자동 번역 결과가
`_meta/review`에 머물고, 사람이 승격하기 전까지 **해당 로케일 페이지가 색인되지 않는다**.

- `app.terms`, `app.privacy` (법률)
- `shared.lib.seo` (title/description/keywords — 순위에 직접 영향)
- `app.home` (랜딩 카피)

### 5.5 유지보수 루프

1. 개발자가 새 한국어 문자열을 **직접 코드에 쓴다** (기존 습관 유지).
2. pre-commit / CI가 `yarn i18n:lint`로 **미추출 한국어 리터럴을 차단**한다.
3. `yarn i18n:extract --apply --only <경로>`로 ko 카탈로그에 편입.
4. `yarn i18n:translate --locale en --review`로 3언어 채움 + 역번역 채점.
5. `yarn i18n:verify`가 게이트 통과를 강제한다.

**`i18n:lint`는 기준선(baseline) 방식**이다. 전면 마이그레이션은 여러 PR에 걸치는데
처음부터 0을 요구하면 게이트를 켤 수가 없고, 켜지 못하면 그사이 새 한국어가 계속
유입돼 마이그레이션이 영원히 끝나지 않는다. 기준선(`messages/_meta/lint-baseline.json`,
파일 단위 카운트)은 "지금보다 나빠지지 않는다"만 강제하고, 마이그레이션이 진행될수록
`--update`로 조여진다. 줄 번호가 아니라 파일 카운트인 이유는 무관한 편집마다
기준선이 흔들리지 않게 하기 위해서다.

> 이 게이트가 설계의 핵심이다. 없으면 6개월 뒤 카탈로그와 코드가 갈라지고
> 다시 367파일을 훑어야 한다.

---

## 6. AI 분석 다국어

### 6.1 제약 (조사 결과)

- `@y0ngha/siglens-core@0.48.0`의 public API에 **`locale`/`language` 파라미터가 존재하지 않는다.**
- 프롬프트가 한국어 출력을 **필드 이름 수준에서 고정**한다:
  `overallConclusionKo`, `riskFactorsKo`, `"All KO fields must be written in Korean (존댓말)"`.
- 분석 캐시 키·TTL은 core 소유이며 로케일을 모른다.
- `CLAUDE.md` / `SCOPE.md` §0: "AI 분석 프롬프트 문구/구조 변경 → core". **siglens에서 구현 금지.**

### 6.2 선택지

| | A. core에 locale 추가 | B. siglens 후처리 번역 |
|---|---|---|
| 분석 품질 | 최상(로케일 네이티브 생성) | 상(원문 품질 유지 + 번역) |
| LLM 비용 | **4×** (로케일당 완전 분석) | 1× + 조회된 로케일당 저가 번역 1회 |
| 캐시 | 4× (Redis 용량·스탬피드 위험) | 원본 1 + 번역 캐시(작음) |
| 변경 범위 | 프롬프트 15개 파일 + 정규화 + `PROMPT_TEMPLATE_VERSION` bump + 교차 레포 릴리스 | siglens 단독 |
| 스코프 가드 | 위반 아님(core PR) | 위반 아님(프레젠테이션 가공) |
| 롤백 | 어려움(warm 심볼은 TTL까지 잔존) | 캐시 삭제로 즉시 |

### 6.3 결정: **B (후처리 번역 레이어)** — 단, A는 백로그로 남긴다

```
entities/analysis-translation/
  lib/proseFields.ts          응답 타입별 산문 필드 화이트리스트 (순수)
  lib/translateAnalysis.ts    추출 → 주입된 translate 함수 호출 → 병합 (순수 오케스트레이션)
  api.ts                      LLM 프로바이더 호출 + Redis 캐시
                              (키: sha256(canonicalProse + locale))
```

> `entities/{slice}/lib/`는 **외부 I/O가 없는 순수 함수만** 담는다(레포 규약).
> 따라서 `translateAnalysis`는 프로바이더를 직접 호출하지 않고
> `(texts: string[]) => Promise<string[]>` 형태의 번역 함수를 주입받는다.
> 실제 SDK 호출과 캐시는 `api.ts`에 둔다. 이렇게 하면 산문 추출·병합 로직을
> 프로바이더 없이 단위 테스트할 수 있다.

동작:

1. 분석은 지금처럼 **한국어로 1회 생성**된다(core 무변경, 비용·품질 불변).
2. 비-ko 로케일 요청 시, 정규화된 응답 객체에서 **산문 필드만** 뽑아 번역한다.
   숫자 필드·enum(`sentiment`, `riskLevel`, `trend`)·가격·티커·식별자는 **손대지
   않는다** — `PROSE_FIELD_NAMES` 화이트리스트에 없으면 후보가 아니다.

   > **수정(라운드 6)**: 초안은 `keyLevels`를 통째로 제외 대상에 넣었는데, 그건
   > "숫자 보호" 논거를 컨테이너 이름에 잘못 적용한 것이었다. `KeyLevel.price`는
   > 숫자지만 `KeyLevel.reason`은 core가 "Korean rationale"로 명시한 **산문**이다.
   > 실제로 `reconciledLevels.exit`/`riskReward`는 번역되는데 같은 `<section>`의
   > `reason`만 한국어로 남아 한 블록에 두 언어가 섞였다. 지금은 `reason`·`basis`·
   > `condition`이 화이트리스트에 있고, 숫자 필드는 이름 자체가 후보가 아니라
   > 구조적으로 걸러진다.
   >
   > 화이트리스트는 **응답 타입별**이어야 한다는 이 문서의 원래 설계가 옳았다.
   > 구현이 `*Ko` 접미사 휴리스틱으로 갈음하면서 `technical`·`options`·`briefing`·
   > `macroBriefing` 네 화면에서 번역이 통째로 no-op이 됐다(라운드 5에서 발견).

3. 저가 모델로 배치 번역, 용어집 주입. **DeepSeek 모델만 허용**한다 —
   `TRANSLATE_MODEL`이 Gemini/Claude ID면 `callDeepseekChat`이 그 ID를 DeepSeek
   엔드포인트에 보내 401이 나고 번역이 조용히 사라지므로, `tryReadTranslatorConfig`
   가 provider까지 검증해 `deepseek-v4-flash`로 폴백한다.
4. 결과를 `sha256(원문 산문) + locale`로 캐시 → 동일 분석은 로케일당 1회만 과금.
5. SSE 스트리밍(`/api/analysis/stream`): ko는 지금처럼 토큰 스트리밍,
   비-ko는 **완료 후 번역**이라 토큰이 흐르지 않는다. UI는 "번역 중" 상태를 표시한다.
   (문장 단위 스트리밍 번역은 v2 — 문맥 손실 대비 이득이 작다.)

   > ⚠️ **번역은 반드시 `heartbeatStream(work)`의 `work` 프로미스 *안*에서 실행한다.**
   > 이 스트림의 진짜 벽은 Cloudflare 125초가 아니라 **ALB idle 60초**다(2026-08-02
   > 프로덕션 실측: heartbeat 없으면 61.1초에 끊김, 25초 heartbeat면 286초 완주).
   > pro 모델 분석은 248초까지 측정됐고 여기에 번역 시간이 더 붙는다. 번역을
   > `heartbeatStream` 바깥에서 await한 뒤 스트림을 만들면 **첫 바이트 전 침묵**이
   > 그대로 60초 벽에 걸린다 — 현재 코드가 `HEARTBEAT_INTERVAL_MS`(25s)로 막고 있는
   > 바로 그 실패다(`src/app/api/analysis/stream/route.ts:675`, `:724`).

**챗봇**: `buildChatPrompt`는 core 소유라 수정하지 않는다. 대신 siglens가 보내는
**사용자 메시지 봉투에 로케일 힌트를 덧붙인다**(호출자의 메시지 본문이므로 core 프롬프트
변경이 아니다). LLM은 질문 언어를 따라가는 성질이 있어 실효가 높다.

> **사용자에게 보고할 사항**: "로케일 네이티브 프롬프트"가 품질 상한이지만
> `siglens-core` PR이 필요하고 분석 비용이 4배가 된다. 번역 품질 불만이 실제로
> 관측되면 그때 core로 승격한다.

> **스코프 경계 명문화 필요**: `SCOPE.md` §3 Step 5의 트리거 목록은
> "Anthropic / Gemini / OpenAI / DeepSeek SDK 호출 → core"라고만 적혀 있어,
> **분석 목적 호출**과 **이미 생성된 산문의 i18n 번역 목적 호출**을 문자 그대로는
> 구분하지 않는다. §1은 i18n을 siglens 소유로 명시하므로 본 설계의 해석이
> 정합적이지만, 이후 기여자가 재논쟁하지 않도록 `SCOPE.md`에 한 줄을 추가한다:
> "이미 생성된 산문을 사후 번역하는 LLM 호출은 프레젠테이션 가공이므로 siglens 소유."
> 이 문서는 core와 공유되는 파생본이라 **core 측 정본에도 같은 줄이 필요하다**.

### 6.4 프리웜·SEO 스냅샷

`/api/cron/seo-prewarm`은 로케일 화이트리스트를 받는다.

**닭-달걀 문제와 그 해소**: "사용자가 방문하면 그때 번역"에 의존하면 비-ko 심볼
페이지는 **영원히 색인되지 않는다**. 크롤러의 첫 방문에는 번역 스냅샷이 없으므로
§7.2 게이트가 noindex를 내고, 크롤러는 noindex 페이지를 재방문하지 않으며,
색인되지 않으니 유기 트래픽도 없다. 순환이 닫힌다.

해소는 두 겹이다.

1. **렌더 경로에서 동기 번역(on-demand ISR)** — 비-ko 심볼 페이지의 첫 렌더가
   ko 스냅샷을 발견하면 그 자리에서 저가 모델로 번역해 응답에 포함한다. 크롤러의
   **첫 방문에 이미 번역된 본문**이 나가므로 게이트를 통과한다. 예산 초과(타임아웃)
   시에만 noindex로 떨어뜨린다 — ISR cold-gen에서 `connection()`이 500을 내는
   제약이 있으므로 번역 실패는 **throw가 아니라 noindex 폴백**이어야 한다.
2. **프리웜 로테이션에 로케일 축 추가** — 커서를 `(symbol, locale)` 쌍으로 돌린다.
   ko 우선순위를 유지하되 비-ko도 순번을 받는다. v1 기본값은 `['ko', 'en']`이고
   ja/zh는 env 플래그로 켠다(ISR write 비용과 직결).

> 2026-08-18에 "프리웜 회전 순번 미도달"로 KR 대장주 3종의 스냅샷이 0행이었던
> 이력이 있다. 로케일 축을 추가하면 회전 주기가 4배가 되므로, 순번 미도달이
> 재현되지 않도록 **로케일별 커서를 분리**하고 진단 순서(DB행 → 마커 → 커서)를
> 그대로 적용한다.

---

## 7. SEO 설계

### 7.0 ⚠️ Next.js 메타데이터는 병합되지 않는다 (실증으로 잡힌 결함)

레이아웃에 `alternates.languages`를 선언해 두면 하위 페이지가 상속할 것 같지만,
**Next.js는 세그먼트 간 메타데이터를 최상위 키 단위로 교체한다.** 페이지가
`alternates: { canonical }`을 선언하는 순간 레이아웃의 `languages`가 통째로 사라진다.
이 레포는 인덱서블 페이지 전부가 자기 canonical을 선언하므로 **hreflang이 한 개도
나가지 않았다** — 빌드도 타입체크도 통과했고, 프로덕션 HTML을 직접 긁어서야 드러났다
(`curl … | grep -c hreflang` → `0`). `openGraph.locale`도 같은 이유로 전 페이지가
`ko_KR`에 고정돼 있었다.

**대응**

- `shared/lib/seoAlternates.ts`의 `localeAlternatesFrom(params, path)` /
  `localeAlternates(locale, path)` / `localeOpenGraph(locale)`를 **페이지마다** 쓴다.
- 레이아웃은 `alternates`를 아예 선언하지 않는다(선언해도 안 나가므로 착각만 만든다).
- `src/app/[locale]/__tests__/localeCoverage.test.ts`가 `src/app/[locale]` 아래
  전 페이지를 훑어 (1) `alternates` 리터럴 직접 선언 금지 (2) 로케일 헬퍼 사용
  (3) 정적 `export const metadata` 금지를 강제한다. 무조건 noindex인 페이지는 제외한다.

### 7.1 head 태그

각 로케일 페이지가 **자기 자신을 가리키는 canonical**을 발급한다(ko를 가리키면 hreflang이 무효).

```ts
alternates: {
    canonical: `${SITE_URL}${localePath(locale, path)}`,
    languages: {
        ko:          `${SITE_URL}${path}`,
        en:          `${SITE_URL}/en${path}`,
        ja:          `${SITE_URL}/ja${path}`,
        'zh-Hans':   `${SITE_URL}/zh${path}`,
        'x-default': `${SITE_URL}${path}`,   // ko
    },
},
openGraph: { locale: OG_LOCALE[locale], alternateLocale: [...나머지] },
```

- `<html lang>`은 `[locale]` 레이아웃에서 로케일별로 발급(현재 `lang="ko"` 하드코딩).
- hreflang은 **상호 참조**여야 한다 — en 페이지도 ko/ja/zh를 전부 선언한다.
- **준비된 로케일이 하나뿐이면 `languages` 키 자체를 내지 않는다.** 자기 자신만
  가리키는 hreflang은 정보가 0이면서 이미 색인된 전 페이지의 HTML을 바꾼다.
  `SYMBOL_INDEXABLE_LOCALES` / `STATIC_INDEXABLE_LOCALES`에 두 번째 로케일이
  추가되는 순간 전 페이지가 한꺼번에 hreflang을 얻는다.
- JSON-LD: `inLanguage`를 로케일로, `WebSite` SearchAction의 `urlTemplate`도 로케일 경로로.

  > **Phase 2 블로커로 명시 이월.** 현재 13개 JSON-LD 블록이 `inLanguage: 'ko'`와
  > ko 절대 URL(`@id`/`url`)을 하드코딩하고 있다. 일부는 모듈 상수라 함수로 바꿔야
  > 한다. **지금은 SEO 영향이 0이다** — `STATIC_INDEXABLE_LOCALES`/
  > `SYMBOL_INDEXABLE_LOCALES`가 ko 하나라 비-ko 페이지는 전부 noindex이고
  > 구조화 데이터가 수집되지 않는다. `STATIC_INDEXABLE_LOCALES`에 로케일을
  > 추가하기 **전에** 반드시 함께 처리한다 — 그때는 언어가 어긋난 구조화 데이터가
  > 실제로 색인된다.
  > 대상: `terms` · `privacy` · `page.tsx`(2) · `economy`(2) · `news`·`news/us`·
  > `news/[category]` · `[symbol]/news` · `MarketRouteBody` · `FearGreedRouteBody` ·
  > `shared/lib/seo.ts`의 `buildSymbolWebPageJsonLd`.
- **noindex 페이지에는 hreflang을 넣지 않는다**(로그인·계정 등).

### 7.2 색인 게이트 — thin 번역 방지

2026-07에 "봇에게 677자만 노출"로 노출이 붕괴한 이력이 있다. 미번역 상태의 `/ja/AAPL`이
한국어 본문을 그대로 담고 색인되면 같은 사고가 3개 언어로 재현된다.

`evaluateSymbolIndexability`에 입력을 추가한다:

```ts
{ symbol, assetInfo, degraded, hasSnapshot,
  locale,                    // 추가
  localizedContentReady }    // 추가: UI 카탈로그 완비 && (ko이거나 분석 번역 존재)
```

→ `locale !== 'ko' && !localizedContentReady` 이면 `{ indexable: false, reason: 'locale-not-ready' }`.

정적 페이지도 같은 원칙: 해당 네임스페이스가 `_meta/review`에 걸려 있으면 그 로케일은 noindex.

### 7.3 sitemap

로케일마다 URL 엔트리를 4배로 늘리지 않는다. 대신 **엔트리 하나에 `xhtml:link` alternates**를 붙인다 — Google이 권장하는 다국어 sitemap 형식이고 파일 크기가 선형으로 유지된다.

```xml
<url>
  <loc>https://…/AAPL</loc>
  <xhtml:link rel="alternate" hreflang="ko"        href="https://…/AAPL"/>
  <xhtml:link rel="alternate" hreflang="en"        href="https://…/en/AAPL"/>
  <xhtml:link rel="alternate" hreflang="ja"        href="https://…/ja/AAPL"/>
  <xhtml:link rel="alternate" hreflang="zh-Hans"   href="https://…/zh/AAPL"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://…/AAPL"/>
</url>
```

`src/entities/sitemap-entry/lib/xml.ts`에 `xmlns:xhtml` 네임스페이스와 alternates 직렬화를 추가한다.
**§7.2 게이트를 통과하지 못한 로케일은 alternates에서 제외**한다 — sitemap이 noindex URL을
광고하면 크롤 예산만 태운다(기존 `financials` ETF 처리와 같은 원칙).

### 7.4 CDN / ISR 영향

- 로케일이 **경로에 있으므로** CF 캐시 키가 자연히 분리된다. `Vary` 헤더를 추가하지 않는다
  (URL 퍼지가 안 먹게 되는 알려진 함정).
- `[locale]`에 `generateStaticParams`를 반드시 둔다 — 없으면 dynamic으로 떨어져 ISR이 꺼진다.
- **다만 4개를 전부 프리렌더하면 안 된다.** 정적 페이지 중 일부(`/market`, `/economy`)가
  빌드 중 FMP 시세를 종목별로 호출하는데, 로케일마다 반복하면 호출량이 4배가 되어
  **FMP가 429로 끊고 빌드가 통째로 실패한다** — 실측으로 확인했다
  (`Failed to build /[locale]/market/page: /en/market after 3 attempts`).
  기본은 ko만 프리렌더하고(`resolvePrerenderLocales`), 나머지는 `dynamicParams`
  기본값에 따라 첫 요청에 on-demand ISR로 생성한다. 크롤러의 첫 방문이 곧 생성
  트리거이므로 SEO 손실이 없다. 확장은 `PRERENDER_LOCALES=ko,en`으로 명시한다.
- `setRequestLocale(locale)`을 **모든 레이아웃과 페이지** 상단에서 호출한다(Next 16.2 = 16.3 미만).
  루트 레이아웃 한 곳만으로는 부족하다 — **실측으로 확인했다**: `backtesting/page.tsx`에
  `getTranslations`를 넣고 `setRequestLocale`을 빼면 빌드 route 표에서
  `● /[locale]/backtesting`이 **`ƒ`(dynamic)** 로 바뀐다. next-intl의 서버 API가 요청
  로케일을 못 찾으면 `headers()`로 폴백하기 때문이다. 빌드는 성공하고 테스트도
  통과하므로, 캐시 비용 청구서로만 드러난다.
  `src/app/[locale]/__tests__/localeCoverage.test.ts`가 전 서버 페이지에 대해 호출을 강제한다.
- 최악의 경우 ISR write가 4배다. v1은 프리웜을 ko+en으로 제한해 실사용 트래픽만큼만 증가시킨다.

---

## 8. 언어 스위처 UI

- **데스크톱**: 헤더 우측, 기존 `shared/ui/PopoverSurface` 재사용(신규 컴포넌트 최소화).
  트리거는 현재 언어 코드(`한국어` / `English` / `日本語` / `中文`).
- **모바일**: `HeaderMobileMenu` 드로어 하단에 섹션으로. 이 드로어는 vaul이 아니라
  `createPortal` + `useFocusTrap`/`useEscapeKey` 직접 구현이다
  (`src/widgets/layout/HeaderMobileMenu.tsx:12,15,38,141`). **Fragment↔Portal 구조를
  바꾸지 않는다** — 스왑은 remount라 focus trap이 죽는다(2026-08 PR #709 교훈).
  vaul을 쓰는 곳은 `views/symbol/MobileAnalysisSheet.tsx` 하나뿐이며 별개 경로다.
- 동작: 같은 경로를 새 로케일로 `replace` 이동(히스토리 오염 방지) + `NEXT_LOCALE` 쿠키 기록.
- a11y: 옵션 각각에 `lang` 속성(`<span lang="ja">日本語</span>`), 언어명은 **자국어 표기 고정**(번역하지 않음).
  `aria-current` 로 현재 언어 표시.

---

## 9. 테스트 전략

| 층 | 검증 |
|---|---|
| 단위 | `routing.ts` 로케일 경로 생성/역파싱, `localePath()` 왕복 |
| 단위 | `proxy` — `/en/aapl` → `/en/AAPL` 정규화, `/en`이 티커로 오인되지 않음, `?q=` 로케일 보존 |
| 단위 | `evaluateSymbolIndexability` 로케일 게이트 4케이스 |
| 단위 | sitemap `xhtml:link` 직렬화 + noindex 로케일 제외 |
| 단위 | `translateAnalysis` — 숫자/enum 필드 불변, 산문만 치환 |
| 통합 | 라우트 인벤토리(32 페이지) × 4 로케일 메타데이터 스냅샷 — **누락 라우트 즉시 실패** |
| 스크립트 | `i18n:verify` 게이트 1–6 자체 테스트 |
| E2E | 언어 스위처(데스크톱/모바일) 전환 후 경로·`<html lang>`·본문 언어 확인 |

---

## 10. 단계별 실행

| Phase | 내용 | 사용자 눈에 보이는 변화 |
|---|---|---|
| **0** | next-intl 도입, `[locale]` 이동, `proxy` 합성, `setRequestLocale`, 라우팅 테스트 | 없음(ko 그대로) |
| **1** | 추출 codemod + ko 카탈로그 + `i18n:lint` CI 게이트 | 없음 |
| **2** | 언어 스위처(데스크톱·모바일) + en 번역 + QA 게이트 + hreflang/sitemap | 영어 UI |
| **3** | AI 분석 후처리 번역 레이어 + 프리웜 로케일 축 | 영어 분석 + **en 심볼 페이지 색인 개시** |
| **4** | ja / zh 번역 + 색인 게이트 확장 | 일·중 지원 |
| **5** | DB 콘텐츠 로케일 컬럼(terms/notices/profile/indicator) | 약관·공지 다국어 |

> ⚠️ **Phase 2의 한계를 명시한다**: Phase 2가 끝나면 UI는 영어가 되지만
> `[symbol]/*`(371 티커 × 최대 9 서브라우트 — 이 사이트 색인 표면의 대부분)는
> **여전히 noindex**다. §7.2 게이트가 분석 번역을 요구하는데 그 레이어는 Phase 3에
> 온다. 그래서 원안(분석 번역을 Phase 4)에서 **Phase 3으로 앞당겼다** — 그러지
> 않으면 "영어 지원"이라 부르면서 정작 검색 유입이 생길 페이지가 전부 닫혀 있다.
> 정적/허브 페이지(37 URL)는 Phase 2에서 곧바로 색인 가능하다.

---

## 11. 알려진 위험과 대응

| 위험 | 대응 |
|---|---|
| `/en`이 티커로 오인돼 301 | `RESERVED_FIRST_SEGMENTS`에 로케일 추가 + proxy 테스트가 로케일 목록 대조 |
| `setRequestLocale` 누락 → 전 라우트 ISR 해제 | 라우트 인벤토리 통합 테스트가 정적 렌더 여부 단언 |
| `generateStaticParams`가 빈 배열 → 같은 ISR 해제 | `resolvePrerenderLocales`가 항상 최소 1개 반환, 테스트가 고정 |
| 전 로케일 프리렌더 → 빌드타임 외부 API 4배 → 429로 빌드 실패 | 기본 ko만 프리렌더, 나머지는 on-demand ISR (실측 확인) |
| 카탈로그 평면 키 → `MISSING_MESSAGE` | 카탈로그·`pickMessages` 모두 중첩 구조, 단위 테스트가 고정 |
| 페이지가 canonical을 명시해 로케일 자기참조가 깨짐 | `localeAlternatesFrom`에 canonical을 넘기지 않는다(degraded일 때만 `null`). 커버리지 테스트가 리터럴 `alternates` 선언을 금지 |
| 내비 활성 상태가 비-ko에서 전부 꺼짐 | `usePathname()`을 `splitLocalePath`로 벗겨 `NAV_TREE`의 무접두사 href와 비교 |
| codemod가 표현식 본문 컴포넌트에 `t`를 정의 없이 삽입 | `classify()`가 `BlockStatement`가 아니면 `applicable: false` |
| i18n 스크립트가 `.gitignore /scripts/**`에 걸려 커밋 안 됨 | `!/scripts/i18n/**` 예외 추가 |
| vitest가 `next-intl/server`를 client stub으로 해석 | `vitest.config.ts`에서 실제 `server.react-server.js`로 alias |
| 미번역 페이지 색인 → thin content 재현 | §7.2 로케일 준비 게이트 |
| 클라이언트 번들에 전체 카탈로그 주입 | 네임스페이스 pick 강제 + bundle 사이즈 회귀 테스트 |
| 통화가 UI 로케일을 따라감(₩→$) | `priceFormat`에 로케일 인자 미추가, 자산군이 통화 결정 |
| `global-error`가 프로바이더 밖 | ko+en 정적 문구 |
| 번역 모델이 숫자를 변형 | 산문 필드 화이트리스트만 번역, 구조 필드 불변 |
| 프리웜 4배로 ISR write 비용 폭증 | 프리웜 로케일 env 화이트리스트(v1: ko, en) |
| 공유 링크 내용이 나중에 언어가 바뀜 | `sharedAnalyses`에 생성 시 로케일 고정 |


---

## 12. 구현 현황 (2026-08-20 기준)

### 완료 — Phase 0 + SEO 배선

| 항목 | 상태 |
|---|---|
| next-intl 4.13.7 도입, `next.config.ts` 플러그인 | ✅ |
| 전 라우트 `src/app/[locale]/` 이동 (32 페이지 + 테스트) | ✅ |
| `shared/i18n/` — locales · routing · navigation · request · loadMessages · clientNamespaces | ✅ |
| `proxy.ts` 합성 (로케일 분리 → 기존 가드 → next-intl 위임) | ✅ |
| 로케일 예약 세그먼트 (`/en`·`/ko`가 티커로 오인되지 않음) | ✅ 테스트 고정 |
| `generateStaticParams` + `setRequestLocale` (ISR 유지) | ✅ 빌드에서 `●` 확인 |
| 언어 스위처 (데스크톱 헤더 + 모바일 드로어, 네이티브 `<select>`) | ✅ |
| 페이지별 hreflang · canonical · og:locale 헬퍼 + 전 페이지 적용 | ✅ |
| 종목 페이지 로케일 색인 게이트 (`SYMBOL_INDEXABLE_LOCALES`) | ✅ |
| sitemap `xhtml:link` alternates 직렬화 + 빌더 배선 | ✅ (로케일 1개라 현재 출력은 동일) |
| 추출 codemod · 번역 · 검증 · lint 스크립트 | ✅ |
| 용어집 27항목 | ✅ |

| en·ja·zh 카탈로그 1,070키 (패리티 100%, ko와 동일 문자열 0) | ✅ |
| AI 분석 후처리 번역 레이어 (`entities/analysis-translation`) | ✅ |
| `i18n:verify`·`i18n:lint` CI + pre-push 배선 | ✅ |

### 5종 감사가 잡아낸 것 — 전부 실제 HTTP 요청으로만 보였다

빌드 EXIT=0, 단위 테스트 10,000+ 통과, 카탈로그 패리티 100%인 상태에서
독립 감사 5건이 아래를 찾았다. **어느 것도 기존 게이트에 걸리지 않았다.**

| 결함 | 왜 게이트가 못 봤나 | 조치 |
|---|---|---|
| `loading.tsx`·`not-found.tsx`의 **서버** `useTranslations` → 종목 페이지 전원 500 (`DYNAMIC_SERVER_USAGE`), 없는 심볼도 404 대신 500 | `[symbol]`은 `generateStaticParams: []`라 빌드가 렌더하지 않는다. 커버리지 가드는 `page.tsx`만 수집했다 | 클라이언트 컴포넌트로 분리. 가드를 `loading`/`error`/`not-found`까지 확장 |
| `/KO`(코카콜라)가 로케일 `ko`로 잡혀 홈으로 리다이렉트 — sitemap의 8개 URL 파손, 일부는 200 soft 404 | next-intl이 로케일 접두사를 **대소문자 무시**로 매칭한다(`middleware/utils.js`). 예약 세그먼트 테스트는 디렉터리 목록만 대조해 실존 대문자 티커와의 충돌을 구조적으로 못 본다 | 정확한 대소문자로 판별해 intl 미들웨어 우회 rewrite. e2e 고정 |
| 미들웨어가 `Link: rel=alternate hreflang`을 전 응답에 부착 → 색인 게이트가 HTTP 계층에서 통째 우회, noindex URL을 alternate로 광고 | HTML만 검사했다. 헤더는 아무도 안 봤다 | `alternateLinks: false` |
| `Set-Cookie: NEXT_LOCALE`이 캐시 대상 ISR HTML에 부착 → CF가 HTML을 캐시하지 않음 | `localeDetection: false`라 **읽지도 않는** 쿠키다. `Vary`는 깨끗해서 설계 검토를 통과했다 | `localeCookie: false` |
| 비-ko 정적 페이지가 한국어 title로 `index:true` (54 URL) | `STATIC_INDEXABLE_LOCALES`가 hreflang·sitemap에만 배선돼 있었다. `robots`는 아무도 안 읽었다 | `localeRobots()` 헬퍼로 전 페이지 게이트 |
| `analysis-translation/api.ts`에 **리터럴 NUL 바이트** → git이 바이너리로 분류, diff가 리뷰에 안 보임 | 타입체크·린트·테스트·빌드 전부 통과. 바이트를 직접 봐야 보인다 | `JSON.stringify` 분리자로 교체 + NUL 가드 테스트 |
| 루트 프로바이더가 카탈로그의 **96.3%**(1,035/1,075키)를 전 라우트에 적재 | 네임스페이스 단위 수집이라 슬라이스에 클라이언트 파일이 하나만 있어도 전체가 딸려갔다 | 키 단위로 좁힘 → 52%(20,718바이트). 동적 키 파일은 네임스페이스 유지 + 커버리지 가드 |
| OG 이미지가 `force-static` + 로케일 미전달로 전 로케일 바이트 동일 | 이미지라 아무 텍스트 검사에도 안 걸린다 | 12개 라우트에 로케일 전달 |
| OAuth 콜백이 비-ko 사용자를 한국어 페이지로 | `/api/*`는 로케일 접두사가 없다. 기존 테스트는 `getLocale`을 `'ko'`로 고정해 **판별력이 0**이었다(`localePath('ko',x)===x`) | state의 `next`에서 로케일 복원 + ja/en 판별 테스트 |
| 서버 액션 리다이렉트 10곳이 전부 ko 고정 테스트 | 위와 동일 — ko는 접두사가 없어 회귀가 관측 불가 | 소스 가드(`noRawRedirect`)로 인자 검사 |

### 5종 감사 라운드 2 — 라운드 1 수정 자체의 결함

라운드 1 수정을 마치고 "전 게이트 통과"를 확인한 뒤에도 감사 5건이 전부 findings를
냈다. 절반이 **라운드 1 수정이 만든 것**이다.

| 결함 | 왜 안 보였나 |
|---|---|
| NUL 가드가 macOS에서 영구 통과 | BSD grep이 `-P`를 거부하고 `\|\| true`가 그 실패를 "위반 없음"으로 바꿈. `grepSource.ts` JSDoc이 금지한 바로 그 패턴을, 그 클래스를 막으려고 만든 가드에서 반복 |
| 테스트 설정이 로케일 인자 무시 | `nextIntlTestConfig`가 항상 ko 반환 → 서버 측 로케일 단언이 전부 항등식. OG 로케일 수정을 되돌려도 테스트 6개가 통과함이 실증됨 |
| `/ja/KO` 로그아웃 → 한국어 홈 | `/KO` 구제 rewrite가 intl 미들웨어를 건너뛰어 `X-NEXT-INTL-LOCALE` 미설정 |
| og:image 전부 301 | 라우트가 `[locale]` 아래로 가며 Next가 `/ko/…`로 이미지 URL 생성 → `/ko` 정규화가 리다이렉트. **한국어 색인 표면**을 때림 |
| 확장 정규식 오탐 37/38 | `then(`·`toFixed(`·`trimTrailingZeros(`를 번역자 호출로 오인 |
| 챗봇 전 로케일 한국어 답변 | 이 문서 §6.3에 **명시해놓고 구현 안 함**. `git diff`가 비어 있었음 |
| `useTimeframeFromUrl` 로케일 유실 | 라운드 1 감사가 보고했는데 수정 누락 |
| 언어 스위처가 쿼리 파괴 | `/reset-password?token=…`에서 언어 전환 시 토큰 소실 |
| SSE 에러 문구가 기준선 **밖** | 스캐너가 `src/app/api/`를 "렌더 안 됨"으로 제외하는데 실제로는 `<ErrorBanner>`에 그대로 뜸 |
| 카탈로그가 전 라우트 적재 | first-load JS +28%, RSC prefetch +45.8% (v0.58.0·PR #719 성과 되돌림) |

**교훈**: 게이트가 초록인 것과 수정이 실제로 동작하는 것은 별개다. 이번 라운드의
모든 수정에 대해 "되돌리면 실패하는가"를 직접 확인했다.

### 감사 라운드 3~8 — 라운드마다 결함의 **성격**이 바뀌었다

| 라운드 | 주된 성격 |
|---|---|
| 1 | 동작 파괴 (종목 페이지 전원 500, `/KO` 파괴, 헤더 누출) |
| 2–3 | 직전 수정의 회귀 (가드 무력화, 에러 경계 원시 키, og:image 404) |
| 4 | 수정이 **적용 안 됨** (`useMemo` deps 누락, 기본값 때문에 반증 불가) |
| 5 | 요구사항이 **절반만 동작** (분석 번역이 9개 화면 중 4개에서 no-op) |
| 6 | 수정의 **전제가 틀림** (`/api/*`가 로케일 스코프라고 가정) |
| 7 | 수정 강제가 **거짓** (기본값이 컴파일러 강제를 무력화) |
| 8 | 수정이 **닿지 않은 형제 경로** (DISPATCH는 테스트했는데 `technical` 분기는 방치) |

라운드 4부터는 모든 수정에 대해 **되돌려서 테스트가 깨지는지** 확인했다. 라운드 8
감사가 그 방식으로 잡은 것들:

| 결함 | 실측 |
|---|---|
| `technical` 분기 로케일 무검증 | `resolveRequestLocale`을 상수로 고정해도 89개 통과 |
| 산문 번역 로케일 결속 무검증 | 두 호출부를 `DEFAULT_LOCALE`로 고정해도 108개 통과 — **다국어 분석이 100% 죽는데** 초록 |
| 색인 게이트 `locale`이 optional | `overall/page.tsx`에서 인자만 빼도 227개 통과. 전 로케일이 색인 대상이 됨 |
| 문구 가드가 중첩 형태를 못 봄 | `{ code, message: '영어' }`를 심어도 가드 3개 + 263개 통과 |

동시에 런타임 감사가 **게이트에 전혀 안 잡히는** 결함을 잡았다. 둘 다 초록인
상태에서만 보이는 것들이라, 정적 게이트와 실물 확인은 서로를 대체하지 못한다:

| 결함 | 증상 |
|---|---|
| 비-ko 종목 페이지 title 소실 | `NOINDEX_SYMBOL_METADATA`엔 title이 없다. `/en/AAPL`의 탭·북마크·`og:title`이 한국어 사이트 기본 문구. 371티커 × 9탭 × 3로케일 |
| 영어에서 문장이 붙어 나옴 | codemod가 `{value}{t(...)}` 이음매에서 잘랐다. ko/ja/zh는 조사·수량사라 맞지만 영어는 `39Chart trends…`, `user@example.comWe sent…` |
| core 문구가 카탈로그를 우회 | 사용량 한도는 **ko 사용자에게도 영어**, BYOK 키 안내는 **en 사용자에게도 한국어** |
| 종목 게이트만 `nofollow` | 정적 게이트(`localeRobots`)는 `follow`였다 — 같은 게이트가 두 표면에서 다른 값 |

### 라운드 9 — 수정이 **런타임에서만** 무효였던 건

라운드 8에서 지수·섹터·스킬 표시명 60개를 카탈로그로 옮겼는데, **화면에는 끝까지
한국어가 나왔다.** 게이트는 전부 초록이었다.

경로는 이랬다. 표시명 조회를 `assetLabel(t, symbol, fallback)` 헬퍼로 빼면서
번역자를 **인자로** 넘기게 됐다. 추출기는 `t(변수)` 호출만 "동적"으로 보므로 그
파일을 리터럴 전용으로 분류했고, 네임스페이스가 좁혀져 키가 클라이언트 페이로드에서
빠졌다. 헬퍼는 `t.has()`로 폴백하도록 짜여 있어 `MISSING_MESSAGE`조차 안 났다.
컴포넌트 테스트는 **전체 카탈로그**로 렌더되므로 이 축소를 구조적으로 볼 수 없었다.

수정은 휴리스틱이 아니라 구조로 했다:

| 조치 | 이유 |
|---|---|
| 조회 테이블을 `shared.assetName`·`shared.skillName` **2세그먼트 전용** 네임스페이스로 분리 | 동적 키는 네임스페이스째 실린다. `widgets.dashboard` 아래 두면 슬라이스 전체가 딸려간다 |
| 헬퍼를 `useAssetLabel()`·`useSkillLabel()` 훅으로 | 번역자를 넘기지 않으면 오분류 자체가 불가능 |
| 점 있는 키를 `091160_KS`로 치환 | next-intl이 `.`를 중첩 구분자로 써서 조회 불가 + 요청마다 `INVALID_KEY` |
| 가드를 **페이로드**에 걸기 | 소스 스캔 가드는 추출기와 같은 모델이라 사이좋게 틀린다 |

부수적으로 드러난 추출기 결함 둘:
- `t.rich('k')`를 참조로 세지 않아 **태그를 쓰는 키가 `--write` 때마다 삭제**됐다.
- `manualKeys.json`이 "삭제 방지"와 "크롬 강제 적재" 두 역할을 겸했다. 라우트
  전용 키를 등록하자 그 네임스페이스가 통째로 크롬에 실려 페이로드가 카탈로그의
  36%가 됐다. `{preserve, chromeWide}`로 쪼갰다.

**추적 과정에서 두 번 헛짚었다.** 처음엔 추출기 정규식을 넓혔다가 페이로드를
부풀렸고, 되돌리면서 `dynamicKeyCall` **정의만 지우고 사용부를 남겨** 추출기가
계속 예외로 죽었다. `>/dev/null` 때문에 그 실패가 안 보였고, 그 사이 측정값이
전부 stale 파일을 읽고 있었다 — [[feedback_build_exit_code_pipe_masks_failure]]와
같은 클래스다.

### 라운드 10 — 라운드 9 수정 자체의 결함 3종, 그리고 **가드가 뚫린 채로 통과**

라운드 9의 핵심 수정(표시명 60개)이 실물로 확인됐다 — `/en/market`의
`S&P 500 Large Cap`·`Technology`, `/ja/market`의 `米国大型株500`,
`/en/market/kr`의 `SEMICONDUCTOR`, `/en/AAPL`의 `Divergence Strategy`,
`INVALID_KEY` 0건. 그런데 그 수정 **자체**가 세 군데 틀려 있었다.

| 결함 | 실측 |
|---|---|
| `verify.mjs` 길이 검사 | 게으른 정규식이 **마지막 분기의 닫는 중괄호를 블록 종료로 먹어** 그 분기가 스캔에서 사라짐. 1,026자를 넣어도 렌더 길이 74자로 계산돼 통과 |
| `verify.mjs` 플레이스홀더 검사 | 같은 원인 + 블록을 통째로 지워 분기 **안**의 `{v9}`를 못 봄. 게이트 통과 후 렌더에서 `MissingValueError` |
| 조회 표를 `chromeWide`에 등록 | `manualKeys.json` 자신이 금지한 형태. `/login`·`/terms` 등 28개 라우트에 1.3KB 사표(死表). 걷어내니 추출기가 소비 라우트에만 정확히 실음(크롬 13.4%→10.3%) |

정규식을 **중괄호 균형 파싱**(`findIcuBlocks`)으로 바꾸고, 플레이스홀더는 분기를
재귀로 훑게 했다.

**가드가 뚫린 채 통과한 건이 또 나왔다.** 직전에 만든 `noRawCoreErrorInHooks`가
`useOverallAnalysis`의 삼항(`typeof result.error === 'string' ? result.error : …`)을
그대로 통과시켰다 — 그 파일이 가드의 목록에 들어 있는데도 8개가 초록이었다.
`??`와 `new XError(result.error)` **두 형태만 나열**했기 때문이다. 형태 나열을
버리고 **에러 생성 인자**만 보도록 바꿨다.

같은 클래스로, `assetLabel` 테스트는 이름이 "en 카탈로그에서 나온다"인데 실제로는
전역 ko 프로바이더로 렌더됐고, 기대값을 `en.json`에서 읽어 **동어반복**이었다 —
en 값을 한국어로 바꿔도 30개가 통과했다. `renderWithIntl(..., { locale: 'en' })`로
실제 en 렌더로 바꾸고, 카탈로그와 무관한 성질(한글 없음)을 추가로 걸었다.

그리고 테스트 6건이 **core의 영어 원문이 그대로 새는 것을 정상으로 단언**하고
있었다. 픽스처가 한국어(`'submit 실패'`, `'일시적 오류'`)라 결함이 안 보였다 —
core가 실제로 주는 값(`Profile not found for symbol: AAPL`)으로 바꾸자 드러났다.

### 라운드 11~13 — SEO 문구 다국어화, 그리고 **게이트가 전부 초록인 채로 나간 SSR 파괴**

라운드 11에서 사용자가 `/en/market`의 한국어 제목을 지적해 SEO title·description을
정적 페이지 + 종목 9탭 전부 다국어화했다(`shared.seo`, 서버 전용 네임스페이스).
`keywords`는 §5.1대로 ko 전용으로 남긴다.

**라운드 12에서 가장 심각한 결함이 나왔다.** 날짜를 로케일화하면서
`SnapshotSummarySection`에 `useCurrentLocale()`(=`'use client'` 컨텍스트 훅)을
넣었는데 그 파일에는 `'use client'`가 없었다. 서버 컴포넌트에서 클라이언트 훅을
부르면 그 서브트리 렌더가 통째로 죽는다:

```
⨯ Attempted to call useCurrentLocale() from the server but
  useCurrentLocale is on the client.
```

**종목 페이지 본문 전체가 전 로케일에서 SSR되지 않았다** — 기본 로케일 ko 포함,
봇에는 크롬만 노출(2026-07 노출 붕괴와 같은 모양). 그런데
`tsc` 0 · `lint` 0 · **테스트 10,697개 통과** · **프로덕션 빌드 0**이었다.
서버/클라이언트 경계는 그중 무엇도 보지 않는다 — vitest는 모든 모듈을 한
런타임에서 돌려 `'use client'`를 무시하고, 빌드는 그 컴포넌트가 실제로 렌더되는
라우트를 프리렌더하지 않았다. **런타임 감사가 유일한 탐지 수단이었다.**

해법은 경계와 무관한 `useResolvedLocale()`(next-intl `useLocale` 기반)과,
소스에서 위반을 잡는 가드다(`noClientHookInServerComponent`).

#### 페이로드: 배럴 하나가 8.4KB를 전 라우트에 실었다

스킬 설명 74키를 추가하자 크롬 페이로드가 카탈로그의 **23.8%**가 됐다. 원인은
홈이 아니라 **404 경계**였다:

```
not-found.tsx → NotFoundContent → import { TickerCategories } from '@/widgets/home'
```

배럴을 타면 홈 전체가 그 경계의 모듈 폐포에 들어오고, 홈 전용 스킬 카탈로그가
크롬에 실려 `/login`·`/terms`까지 따라다닌다. 파일 직접 import로 끊고 홈을
라우트 그룹 `(home)`으로 옮겨 자기 버킷을 주자 **7.3%**가 됐다(기존 최저 11.2%
보다도 낮다). 프로덕션 배럴-only 규칙에 대한 의도적 예외이고, 그 근거를
`NotFoundContent.tsx` 주석에 남겼다.

#### 반복된 실패: 동적 조회 키의 조용한 삭제

`yarn i18n:extract --write`는 리터럴 `t('…')` 스캔으로 `ko.json`을 다시 만든다.
`t(KEY_MAP[value])`처럼 **변수로** 오는 키는 스캔에 안 잡혀 삭제된다. 이 브랜치에서
같은 실수를 **다섯 번** 했다 — `assetName`·`skillName`·`enumLabel`·캡션·
`regionDescription`. 매번 `i18n:verify`의 고아 키 검사가 잡았지만 **삭제된 뒤**였다.
`manualKeys.preserve` 등록이 선행 조건이고, 그 근거를 그 파일 주석에 못 박았다.

### 라운드 14 — 게이트가 **원리적으로** 못 보는 경로 두 개

지금까지의 결함은 "가드가 허술해서" 놓친 것이었다. 이 라운드에 드러난 둘은
성격이 다르다 — 현재 게이트 구성으로는 **볼 수가 없다.**

#### 1. 하이드레이션 이후에만 나타나는 원시 키

종목 페이지의 **가시 h1**이 네 로케일 전부에서 문자열
`views.symbol.chartPageHeading.heading`을 렌더했다. SSR HTML의 sr-only h1은
정상이라, 크롤러와 사용자가 서로 다른 것을 봤다 — `chartPageHeading.ts` JSDoc이
막으려던 cloaking 그 자체다.

원인은 **번역자를 인자로 받는 헬퍼**다. `extract.mjs`의 `keysForFiles`는 번역자
선언이 없는 파일에서 조기 반환하므로(`translatorNamespace.size === 0`) 그 파일의
`t('literal')`을 수집하지 않는다. 반면 `collectReferencedKeys`는 파일 종류를
가리지 않고 스캔하므로 **`ko.json`에는 키가 남는다** — `i18n:verify`도, extract
드리프트 게이트도 통과한다. 정적 HTML 스캔으로는 하이드레이션 이후를 볼 수 없고,
vitest는 페이로드가 아니라 전체 카탈로그로 렌더한다.

해법: 헬퍼는 **키만 내보내고**(`CHART_PAGE_HEADING_KEY`) `t()` 호출은 소비 파일에서
한다. 그리고 그 키가 라우트 페이로드에 있는지 테스트로 못 박았다.

#### 2. 서버/클라이언트 경계

`'use client'` 없는 모듈이 클라이언트 전용 훅을 부르면 그 서브트리 렌더가 죽는데,
`tsc`·`oxlint`·테스트 10,697개·프로덕션 빌드가 전부 통과한다(§라운드 12 참고).
가드를 만들었지만 **이름 2개 화이트리스트**였고, 그 뒤 늘어난 훅 셋을 놓쳤다.
목록을 도출식(`'use client'` 모듈이 내보내는 `use*`)으로 바꾸자 **즉시 실제
잠재 결함 2건**이 걸렸다. `export const useX` 화살표 형태까지 포함해야 한다.

#### 반복된 실패의 정리

동적 조회 키의 조용한 삭제가 이 브랜치에서 **일곱 번** 재발했다. 매번
`i18n:verify`의 고아 키 검사가 잡았지만 **삭제된 뒤**였다. 순서를 뒤집었다 —
키를 추가할 때 `manualKeys.preserve` 등록을 **먼저** 한다.

그리고 파일 수정에 라인 인덱스 슬라이싱을 쓰다 한 세션에 두 번 파일을 훼손했다
(121줄 소실, 이웃 상수 삼킴). 앵커 문자열 + `assert` 후 `replace`만 쓴다.

### 알려진 한계 — `notFound()` 404 본문이 SSR되지 않는다

`notFound()`로 도달한 404는 Next가 내장 셸(`<html id="__next_error__">`)로 문서를
만들고 앱 트리는 RSC flight로만 실어 보낸다. JS 없이는 제목만 보인다.

원인은 콘텐츠가 아니다 — 본문을 `<main>PROBE</main>` 한 줄짜리 서버 컴포넌트로
바꿔도 동일했다(intl·클라이언트 여부와 무관). 루트에 `<html>`을 렌더하는 레이아웃이
없어서인데, `lang`이 로케일별로 달라야 해 `<html>`은 `[locale]/layout.tsx`가 소유할
수밖에 없다. 패스스루 루트 레이아웃을 넣어도 바뀌지 않았다.

완화: 상태 코드는 정확히 404, `<title>`은 로케일별로 정확. **매칭 실패** URL은
루트 `src/app/not-found.tsx`가 완전한 문서를 SSR한다(실측 확인).

### ⛔ 배포 순서 — 이 브랜치만으로는 안전하지 않다

구버전 인스턴스는 `RESERVED_FIRST_SEGMENTS`에 로케일이 없어 이렇게 응답한다:

```
/en/AAPL → 301 Location: /EN/AAPL   (Cache-Control 없음)
/EN/AAPL → 404
```

`infra/aws/deploy.sh`가 `MinHealthyPercentage:100`이라 신·구가 ~18분 동시 서빙하고,
**롤백 시에는 100% 재현**된다. `Cache-Control`이 없어 브라우저가 영구 캐시한다.

301을 내는 쪽이 구버전이므로 이 브랜치에서 고칠 수 없다. **master에
`RESERVED_FIRST_SEGMENTS`에 `ko`·`en`·`ja`·`zh`를 추가하는 선행 릴리스**를 먼저
배포해야 한다(4줄). 그러면 구버전이 301 대신 404를 내 전환이 양방향으로 안전해진다.

### 남은 작업

| Phase | 내용 |
|---|---|
| 1 | 잔여 1,666건 이관 (§13) — 카탈로그 자체는 확정. 숫자·날짜 포맷(`INTL_LOCALE`)도 여기서: 현재 전 로케일 `ko-KR` 고정이라 `/ja`에서 시가총액이 `US$3.5조`로 나온다(호출부 5곳에 로케일 스레딩 필요) |
| 1 | 이메일 본문 번역 — 링크 로케일 유실은 수정됨, 본문은 카탈로그·시그니처 변경 필요 |
| 1 | PWA manifest 로케일화. ⚠️ `[locale]` 아래로 옮기면 프록시 matcher가 `.webmanifest`를 제외해 **설치된 PWA가 전부 404**가 된다 — matcher 제외를 먼저 풀어야 한다 |
| 2 | **JSON-LD 로케일화**(`inLanguage`·`@id`·`url`) → 그 다음에야 `STATIC_INDEXABLE_LOCALES` 확장. 지금 `@id`가 `/market`과 `/en/market`에서 충돌한다 |
| 3 | SSR 시드 경로 번역 — 현재 번역은 SSE 경로에만 걸려 있어, 캐시된(=흔한) 심볼은 `/en/AAPL`이 한국어 산문을 렌더한다. `SYMBOL_INDEXABLE_LOCALES` 확장의 선결 조건 |
| 4 | 번역 호출에 `AbortSignal` 연결 — 자체 마감(`TRANSLATION_DEADLINE_MS` 60초)은 붙었지만 초과 시 DeepSeek 소켓 자체는 SDK 기본값(10분×3)까지 살아 있다 |
| 5 | DB 콘텐츠 로케일 컬럼 · manifest 로케일화 · `/ko/*` 정규화를 307→301 |


---

### 라운드 15 — DB 축의 결함은 **번역이 도착한 뒤에만** 드러나는 종류였다

이 라운드는 게이트가 전부 초록이고, 화면도 정상이고, 심지어 **번역까지 정확히
생성되는데** 결과가 버려지고 있던 경로들을 잡았다.

| 결함 | 왜 안 보였나 |
|---|---|
| `resolveNewsSummary`/`resolveNewsBody`가 **호출부 0개** — 카드가 `item.summaryKo`를 그대로 렌더 | 제목은 배선돼 있어 "번역된 것처럼" 보였다. 두 함수의 유일한 import가 자기 테스트라 스위트는 초록이었고, `NewsList.test.tsx`·`MarketNewsCard.test.tsx`는 **한국어 본문이 렌더되는 것을 기대값으로 못 박아** 반쯤 배선된 상태를 굳혔다 |
| 경제 캘린더 요약·해석도 같은 구조 | 위와 동일. 사이드카에 `economicCalendar`가 등록돼 있어 번역 비용은 나갔다 |
| `assetName`·`economicIndicator`·`seoSnapshot`·`sharedAnalysis`가 **읽는 경로 없이** 레지스트리에 등록 | 백필·번역이 도는데 아무도 읽지 않는다. 정상 동작과 구별이 안 된다 |
| 공지 `isTranslationFallback`이 소비자 0개 | 페이로드만 차지 |
| 홈 `title`이 루트 `title.template`에 먹혀 `| Siglens`가 부활 | 마스터의 홈은 `title`을 **반환하지 않아** 레이아웃 `default`가 그대로 나갔다. 카탈로그로 옮기며 문자열을 돌려주는 순간 템플릿이 적용됐다 — v0.48.0에서 SERP 폭을 되찾으려 일부러 뗀 접미사다 |
| 홈·`/backtesting`·`/terms`·`/privacy`의 `og:url`이 전 로케일 동일 | 다른 페이지들은 이미 로케일 URL을 쓰고 있어 눈에 안 띄었다 |
| `Dataset` JSON-LD `url`이 로케일 무관 | 위와 같은 이유 |
| `localeAlternates`가 **자기를 뺀** hreflang 클러스터를 선언 | `STATIC_INDEXABLE_LOCALES`가 `[ko]` 하나라 지금은 발화하지 않는다. 두 번째 로케일을 넣는 순간 난다 |

**공통 원인**: 이 축의 결함은 "출력이 틀렸다"가 아니라 **"출력이 안 쓰인다"**다.
값 비교로는 잡히지 않고, 폴백이 항상 그럴듯한 값을 내놓기 때문에 화면으로도
안 잡힌다.

**그래서 만든 가드**: `contentTranslationRegistry.test.ts` — `TRANSLATABLE_ENTITY`의
모든 키에 대해 백필·번역 스크립트가 **아닌** 프로덕션 파일이 그 키를 참조하는지
검사한다. 등록만 하고 읽지 않으면 CI가 막는다. 뮤테이션으로 확인했다(가짜 엔티티
추가 → 실패, 제거 → 통과).

**부수적으로 드러난 것**: `vi.mock('@/shared/lib/seo', () => ({...}))` 통짜 목이
6개 파일에 있었다. 모듈에 export가 하나 생길 때마다 깨질 뿐 아니라, URL을
만드는 로직 자체가 스텁으로 대체돼 **테스트가 아무것도 검증하지 못한다**.
`importOriginal` 부분 목으로 바꾸자 `og:url` 로케일 검증이 실제로 동작했다.

## 13. 잔여 미추출 한국어 (2026-08-20 실측)

`yarn i18n:lint` 기준 **1,625건**. 신규 유입은 기준선 게이트가 막고 있다.
성격별로 나누면 남은 일의 종류가 다르다 — 숫자만 보면 "번역이 덜 됐다"로 읽히지만
상당수는 **번역 대상이 아니거나, 표시가 아니라 데이터 경로 작업**이다.

| 분류 | 건수 | 성격 | 다음 작업 |
|---|---|---|---|
| `non-component-module` | 1,038 | `.ts` 상수·유틸. 훅을 부를 수 없다 | 키 노출 + 소비자 리팩터 |
| `module-scope-or-helper` | 510 | `.tsx` 모듈 스코프 상수 | 동일 |
| `seo-keywords-ko-only` | 107 | **번역 대상 아님** — ko 전용 데이터로 확정(§5.1) | 없음 |
| `template-needs-icu-review` | 98 | 표현식이 섞인 템플릿 | ICU 변환(사람이 문장 확인) |
| 기타 | 14 | import 경로·파라미터 기본값 | 개별 처리 |

### 파일별 상위와 판단

| 파일 | 건수 | 판단 |
|---|---|---|
| `shared/lib/seo.ts` | 229 | 페이지 title/description. **사람 검수 필요**(설계 §5.4의 `reviewRequired`) |
| `shared/config/dashboard-tickers*.ts` | 129 | **데이터**. core 타입이 영문명을 이미 갖고 있어 `localizedAssetName`으로 고르면 된다 |
| `shared/config/popular-tickers.ts` | 97 | **데이터**. 개별 종목은 영문명이 core 타입에 없다 — `assetTranslations`(DB) 조회 경로가 필요하다(표시 계층 작업이 아니다) |
| `app/[locale]/homeJsonLd.ts` | 40 | JSON-LD. §7.1의 **Phase 2 블로커**로 이월 |
| `entities/economy/lib/indicatorNameKo.ts` 외 | 57 | 경제지표 한국어명. `economicIndicatorTranslations`(DB)에 로케일 축을 더하는 §2.5 작업과 함께 |
| 위젯 UI 카피(`SignalBadge`·`optionsTooltips`·`technicalFacts` 등) | 90+ | 순수 UI 카피 — 키 전환 대상 |

### ⚠️ 잔여의 성격 — "불활성 상수"가 아니다

`non-component-module` 분류가 오해를 부른다. 이 버킷의 상당수는 **사용자가 실제로
읽는 문구**이고, 일부는 한 문자열 안에 두 언어가 섞인다. 실측(`/ja/AAPL`에서
한국어 42개 vs 일본어 25개 텍스트 노드):

| 위치 | 증상 |
|---|---|
| `widgets/layout/HeaderNavMenu.tsx` | `aria-label`이 `市場分析 바로가기` — 스크린리더가 전 페이지에서 읽음 |
| `widgets/layout/Header.tsx` | 홈 링크 접근명 `SIGLENS 홈` |
| `widgets/dashboard/IndexCard.tsx` 외 | `title="AAPL 분석"` |
| `entities/auth/lib/loginUser.ts` | `/ja/login`은 100% 일본어인데 실패 시 `이메일 또는 비밀번호가 올바르지 않습니다.` |
| `views/symbol/utils/symbolTabsConfig.ts` | 종목 탭바 9개 라벨이 전 로케일 한국어 |
| `entities/chat-message/lib/derivePageContextLabel.ts` | 일본어 대화에 한국어 버블 주입 |
| `shared/lib/legal.ts` | 푸터가 비-ko 90개 페이지 전부 한국어 |

또한 `scripts/i18n/lib/context.mjs`의 "`.ts`에는 컴포넌트가 없다 → 훅을 부를 수
없다"는 전제가 부정확하다 — 커스텀 훅은 `.ts`에 있고 `useTranslations`를 부를 수
있다. 1,054건 중 **59건이 14개 `use*.ts` 훅 파일**에 있고, 그중 몇은 이미
`useStreamErrorMessages()`를 부르고 있다. 즉 Phase 1의 실제 난이도는 이 분류가
시사하는 것보다 낮다.

### 이미 만들어 둔 것

- `i18n:lint` 기준선 — 잔여를 **늘리지 못하게** 고정한다. 줄어들면 `--update`로 조인다.
  CI와 pre-push에 배선돼 있다(사람이 손으로 칠 때만 도는 게이트는 결국 돌지 않는다).

### 표시명 3종은 일괄로 끝냈다 (라운드 8)

한때 "Phase 1로 미룬다"고 적었던 항목이다 — 일부만 배선하면 **같은 페이지에서
일부만 영어**가 되어 지금보다 나쁘다는 이유였다. 라운드 8 런타임 감사가 그
"일부"조차 이미 깨져 있음을 실측으로 보여줘서(영어 문장 옆의 `기술·금융`,
일본어 페이지의 `다이버전스 전략`), 세 계열을 한 번에 끝냈다.

| 계열 | 개수 | 위치 |
|---|---|---|
| 지수 + 섹터명 | 24 | `widgets/dashboard/assetLabel.ts` — 심볼로 조회 |
| 스킬명(패턴·전략·지표) | 36 | `widgets/analysis/skillLabel.ts` — 이름으로 조회 |

둘 다 **표시 시점 조회**다. 원본 문자열을 못 바꾸기 때문이다:
- 섹터명은 `BriefingCard`의 화이트리스트 대조가 `koreanName` 기준이라, 번역하면
  모든 행이 걸러져 섹터 표시가 통째로 사라진다.
- 스킬명은 `AnalysisPanel`에서 **dedupe 키**로도 쓰여, 번역하면 중복 제거가 깨진다.

카탈로그에 없는 심볼·이름은 원문으로 떨어진다. 이 폴백이 없으면 config에 ETF를
하나 추가하는 순간 카드에 원시 키(`widgets.dashboard.assetName.XLQ`)가 에러 없이
찍힌다.

**남은 것은 개별 종목명이다**(`popular-tickers.ts` 97건). 이쪽은 core 타입에
영문명이 없어 `assetTranslations`(DB) 조회 경로가 필요하다 — 표시 계층 작업이
아니라서 여기 묶지 않았다.
