# Project Scope — `siglens` vs `siglens-core`

> 이 문서는 **양쪽 프로젝트가 공유하는 단일 source-of-truth**다.
> `siglens-core` 레포에 위치하며, `siglens` 레포는 자신의 README/CLAUDE.md에서
> 이 문서로 링크한다. 분담에 대한 모든 결정은 이 문서에서만 갱신한다.
>
> 📎 **이 파일은 `siglens-core/docs/SCOPE.md`를 siglens 측에 맞춰 재구성한 파생본**이다.
> Refactor 진행 동안 양쪽이 함께 변경되었으므로 정본 단일성은 보장되지 않는다.
> 분담 원칙의 큰 줄기는 양쪽이 일치하지만, 본 문서는 siglens 관점의 추가 섹션(§7 Ejection Roadmap 등)을 포함한다.

> ⚠️ **2026-05 재정의**: core를 다시 좁힌다.
> "분석(analysis) 도메인 + 분석에 직결된 infrastructure + Skills 시스템"만 core가
> 소유한다. 일반 백엔드 기능 — 인증/세션/OAuth, 이메일, 사용자 DB 스키마,
> 문의(contact) 폼, BYOK(사용자 LLM API 키), 한국어 티커 검색·매핑, 사용량 로그
> DB 구현 — 은 `siglens` 영역으로 환원한다(7단계 ejection). 자세한 단계는
> §7 참고.

---

## 0. 작업-경계 체크리스트 (siglens 개발자 시점)

> 새 작업을 받자마자 **가장 먼저** 본다. 작업 설명이 이 표의 어느 한 행에라도
> 매칭되면 siglens-core 레포에서 진행할 일일 가능성이 높다. siglens 안에서
> 구현하기 전에 잠시 멈추고 §3 결정 트리로 한 번 더 확인한다.

### 다음 작업은 `@y0ngha/siglens-core` 영역일 가능성이 높습니다 — 시작 전에 확인하세요

| 트리거 패턴 | 어디로 |
|---|---|
| 새 보조지표 추가 / 기존 지표 계산식 변경 (RSI, MACD 등) | → core |
| 새 신호 감지(crossover, divergence 등) | → core |
| 캔들 패턴 / 차트 패턴 판정 / 임계값 조정 | → core |
| AI 분석 프롬프트 문구 / 구조 변경 | → core |
| 응답 정규화 / 검증 / 후처리 룰 추가 | → core |
| Skills (.md) 시스템 자체의 동작 변경 | → core |
| 분석 캐시 키 / TTL / 만료 정책 변경 | → core |
| 분석 Job 큐 라이프사이클 | → core |
| 재분석 쿨다운 정책 | → core |
| 대시보드 신호 스캐너 알고리즘 | → core |
| 티어별 제한 정책 (TIER_CONFIG, isAllowed 등) | → core |
| AI 챗 프롬프트 빌더 | → core |
| 사용량 제한 정책 (checkAnalysisLimit, checkChatbotLimit) | → core |

### 반대로, 다음은 siglens에 남는 작업입니다

| 영역 | 어디로 |
|---|---|
| Server Action 어댑터, Next.js cookies/redirect 호출 | → siglens |
| 인증 use-case (registerUser, loginUser, ...) 및 그 어댑터 | → siglens |
| OAuth start/callback 라우트 | → siglens |
| 이메일 발송 (Resend) 어댑터 | → siglens |
| 사용자/세션/티어 set CRUD | → siglens |
| BYOK API key 저장 / 암호화 | → siglens |
| 한글 ticker 검색 / 매핑 use-case | → siglens |
| Drizzle DB schema 및 모든 Repository 구현 | → siglens |
| Gemini SDK 어댑터 (callAiProvider 구현) | → siglens |
| UI 컴포넌트, hooks, 페이지, 디자인 | → siglens |
| i18n / 표시 포맷 / 에러 토스트 | → siglens |

이 두 표 어디에도 명확하지 않으면 SCOPE.md §3 결정 트리를 따라가세요.

---

## 1. 두 프로젝트의 역할

### `@y0ngha/siglens-core` — 라이브러리

**한 줄 정의**: "분석 도메인의 secret sauce + 분석에 직결되는 외부 시스템 래퍼."

```
- 무엇을 담는가:
  · 도메인 계산 (지표, 캔들/차트 패턴, 분석 프롬프트 빌더, 신호 감지)
  · 응답 정규화 / AI 레벨 보정 / 키레벨/추세선 보조
  · 분석 use-case (submitAnalysis, pollAnalysis, submitBriefing,
    pollBriefing, fetchBarsWithIndicators, requestChatCompletion 등)
  · 분석에 직결된 infrastructure:
      - AI provider 호출 (Claude / Gemini wrapper)
      - 분석 결과 캐시 (Upstash Redis)
      - Job 큐 (분석 워커 라이프사이클)
      - 시장 데이터 provider 인터페이스 (실제 fetch는 consumer가 주입)
      - Skills 파일 로더 (`skills/*.md`)
  · Tier 게이팅 / 분석 사용량 IP 해싱(`hashUsageIp`) / 쿨다운
  · 위 모든 항목의 공개 타입과 상수

- 무엇을 담지 않는가:
  · UI / 렌더링 / CSS / 이미지 / 폰트
  · React, Next.js, 라우팅, 미들웨어
  · 시세/옵션 데이터 프로바이더(FMP, yahoo-finance2)의 실제 호출 코드 — 인터페이스만 소유
  · 인증 / 세션 / OAuth / 이메일 발송 / 비밀번호 재설정
  · `users` / `sessions` / `oauth_accounts` 등 사용자 DB 스키마 정의·마이그레이션
  · 문의(contact form) 처리, BYOK(사용자 LLM API 키) 저장·검증
  · 한국어 티커 검색·매핑 (KOREAN_TICKERS 캐시, `assetTranslations`)
  · `usage_logs` DB 스키마 / Drizzle repository 구현
    (단, IP 해싱 함수는 분석 use-case가 직접 호출하므로 core에 남는다)
  · 사용자별 설정 화면, 관리자 화면, 결제, 마케팅 페이지
```

### `siglens` — 소비자(웹 앱)

**한 줄 정의**: "siglens-core의 분석 기능을 사용자에게 제공하는 Next.js 앱 +
일반 백엔드(인증·이메일·사용자 DB·문의·BYOK·티커 매핑·사용량 기록)."

```
- 무엇을 담는가:
  · UI 컴포넌트, 페이지, 레이아웃, 차트 렌더링, 디자인 시스템
  · Next.js Server Action / Route Handler / Middleware
  · 인증 / 세션 / OAuth 콜백 / 이메일 발송 (사용자 DB 스키마 포함)
  · 비밀번호 재설정·이메일 인증 토큰 저장소
  · 문의(contact form) 처리, BYOK 저장·검증
  · 한국어 티커 검색·매핑 (KOREAN_TICKERS 캐시 + `assetTranslations` repo)
  · `usage_logs` DB 스키마 / Drizzle repository (core가 호출)
  · MarketDataProvider / OptionsDataProvider 구현체 — FMP, yahoo-finance2 같은 데이터 소스의 실제 호출 코드
  · 환경변수 주입 (siglens-core의 infrastructure가 process.env를 읽지만,
    값을 채우는 책임은 consumer)
  · 사용자 인터랙션, 폼, 에러 토스트, 로딩 스피너
  · 페이지 SEO, 메타데이터, 사이트맵
  · siglens-core가 노출하지 않는 "프레젠테이션 전용 가공" (문자열 포맷, i18n)

- 무엇을 담지 않는가:
  · 지표 계산식, 캔들 패턴 판정 로직, 신호 감지 임계값 — core에만 존재
  · AI 프롬프트 문자열 조립 — core의 `buildAnalysisPrompt` 등을 호출
  · 분석 결과 캐시 키 포맷 / TTL / Job 큐 라이프사이클 — core가 소유
  · Skills 시스템 — core가 소유
  · 분석 티어 제한·사용량 카운트·쿨다운 비즈니스 규칙 — core가 소유
```

---

## 2. 의존 방향

```
siglens (Next.js 앱 + 일반 백엔드)
    │
    │  import from '@y0ngha/siglens-core'
    │  (분석 use-case · 도메인 함수 · 분석 인프라 factory)
    ▼
siglens-core (npm 패키지 — 분석 도메인 + 분석 직결 인프라 + Skills)
    │
    └── domain → infrastructure → application
        (레이어 의존 규칙은 docs/architecture/ARCHITECTURE.md 참고)
```

**규칙**

- `siglens` → `siglens-core` 단방향만 허용한다.
- `siglens-core`는 `siglens`의 존재를 모른다. core 안에 "siglens에서는 …" 같은
  분기 코드가 들어가면 안 된다.
- `siglens`는 **`src/index.ts`에서 export된 심볼만** import한다. deep import
  (`@y0ngha/siglens-core/dist/...`)는 금지. 자세한 정책은 `siglens-core/docs/PUBLIC_API.md`.
- 분석에 영향 없는 기능(인증·이메일·BYOK 등)은 core에 추가하지 않는다.
  이미 들어가 있는 것은 §7 ejection 로드맵으로 환원한다.
- core가 `usage_logs` 같은 DB에 직접 쓰는 use-case가 필요하면, repository
  인터페이스를 core가 정의하고 구현은 consumer가 주입한다.

---

## 3. 결정 트리 — "이 코드 어디에 둘까?"

새 코드를 짤 때 다음 6단계를 순서대로 적용한다. **첫 YES에서 멈춘다.**

### Step 1 — DOM/React/Next.js를 직접 만지는가?

```
컴포넌트, JSX, useState, headers(), cookies(), redirect(),
NextResponse, "use client", "use server", CSS, 이미지 import
```

**YES → `siglens`로 간다.** core는 이런 것을 절대 import하지 않는다.

### Step 2 — 인증·이메일·BYOK·문의·한국어 티커·사용자 DB 스키마인가?

```
세션 발급/검증, OAuth 콜백 데이터 처리, 비밀번호 해싱
이메일 토큰 저장·발송, 비밀번호 재설정 흐름
사용자 LLM API 키(BYOK) 저장·복호화·검증
contact form 처리
한국어 티커 검색·매핑, asset translation
users / sessions / oauth_accounts / user_api_keys / inquiries / usage_logs
   스키마, 마이그레이션, repository 구현
```

**YES → `siglens`로 간다.** 이 영역은 분석 도메인의 secret sauce가 아니므로
core가 가질 이유가 없다. 일반 SaaS 백엔드 기능이다. 진행 중인 ejection은
§7 참고.

> 예외 — IP 해싱: `hashUsageIp`처럼 분석 use-case가 직접 호출하는 순수 함수는
> `usage_logs` repository와 분리되어 core에 남는다(`infrastructure/usage/`).

### Step 3 — 외부 시장 데이터 API(FMP, yahoo-finance2 등)를 직접 호출하는가?

```
fetch('https://financialmodelingprep.com/...')
yahooFinance.options(...)
```

**YES → `siglens`로 간다.** core는 `MarketDataProvider` 인터페이스만 소유한다.
실제 fetch 코드는 `siglens` 측에서 구현해 core 함수에 주입한다.

> 예외: `infrastructure/fmp/config.ts`처럼 환경변수 reader는 core에 있을 수 있다.
> 그러나 시세를 가져오는 fetch 자체는 core에 두지 않는다.

### Step 4 — 분석 도메인 계산이거나, AI 프롬프트 조립이거나, 분석 비즈니스 규칙인가?

```
지표 계산식 (RSI, MACD, …)
캔들/차트 패턴 판정
분석 티어별 제한, 분석 사용량 카운트, 분석 쿨다운
AI 프롬프트 빌더 (buildAnalysisPrompt 등)
응답 정규화 (normalize*, enrich*, filter*)
Skills 카탈로그
```

**YES → `siglens-core`의 `domain/` 또는 `application/`로 간다.**
분석 secret sauce가 `siglens` 쪽으로 새면 두 가지 문제가 생긴다.
(1) 워커/CLI 등 다른 consumer가 같은 로직을 재구현해야 한다.
(2) 분석 비즈니스 규칙이 두 곳에 흩어져 일관성이 깨진다.

### Step 5 — 분석에 직결된 외부 시스템 I/O인가? (AI provider / 분석 캐시 / 분석 Job 큐 / Skills 파일)

```
Anthropic / Gemini SDK 호출
Upstash Redis 명령(분석/브리핑 캐시 키)
분석 Job 큐 enqueue / status / result
skills/*.md 파일 읽기
```

**YES → `siglens-core`의 `infrastructure/`로 간다.**
core는 이 I/O를 인터페이스 뒤에 숨긴다. `siglens`는 factory 함수
(`createCacheProvider`, provider factory, `FileSkillsLoader` 등)를
호출해 인스턴스를 받아 쓰기만 한다.

> 분석과 무관한 외부 시스템(이메일 SMTP, 인증 DB, OAuth 토큰 revoke 등)은
> core가 아니라 `siglens`로 간다. Step 2를 다시 본다.

### Step 6 — 위 어디에도 해당하지 않는가?

```
사용자별 컴포넌트 상태, URL 파싱, 페이지 메타데이터,
i18n 메시지, 로딩 UI, 에러 토스트, 분석 결과 화면 포맷팅
```

**기본값 = `siglens`.** 프레젠테이션 책임이거나 Next.js 런타임에 종속된 코드다.

---

## 4. 안티 패턴 (절대 하지 말 것)

### siglens-core 쪽

```
❌ core 안에서 React import
   → core는 framework-agnostic. UI 의존 0.

❌ core 안에서 process.env를 domain 레이어가 읽음
   → 환경변수는 infrastructure에서만. domain은 순수.

❌ core 안에서 fetch/yahoo-finance2를 호출해 FMP/옵션 데이터를 직접 가져옴
   → MarketDataProvider 인터페이스로 추상화. 구현은 consumer.

❌ core 안에서 "siglens 앱에서는 이렇게…" 같은 조건 분기
   → core는 자신의 consumer를 모른다. 일반화된 옵션으로 표현한다.

❌ core 안에 인증/세션/OAuth/이메일/BYOK/문의/한국어 티커/사용자 DB 스키마를
   새로 추가
   → 분석 secret sauce가 아니다. siglens 영역. §7 ejection 진행 중.

❌ Tier 1~4가 아닌 internal 함수를 src/index.ts에서 export
   → 우회 import 차단. PUBLIC_API.md 따름.
```

### siglens 쪽

```
❌ deep import: '@y0ngha/siglens-core/dist/domain/...'
   → 다음 minor 버전에서 깨진다. src/index.ts public API만 사용.

❌ siglens 내부에 RSI 계산식, 캔들 패턴 임계값, AI 프롬프트 문자열을 복제
   → core에 같은 함수가 있다. 없다면 core에 PR을 올려 추가한 뒤 import.

❌ siglens 내부에 분석 결과 캐시 키 빌더, 분석 Job 큐 키 패턴 정의
   → 모두 core가 source-of-truth.

❌ siglens 내부에서 process.env(분석 인프라용)를 읽어 core 함수에
   "옵션 객체"로 다시 넣어 전달
   → core의 infrastructure가 직접 process.env를 읽도록 설계되어 있다.
     consumer는 .env 값을 채우기만 하면 된다.
     (예외: 채팅 Gemini key fallback처럼 core가 명시적으로 string config을
      파라미터로 받는 경우만 consumer가 주입한다.)

❌ siglens가 core의 internal 헬퍼(예: 개별 detectRsiOversold)를 흉내 내어 재구현
   → 통합 진입점(detectSignals)을 사용한다. 부족하면 core를 확장한다.
```

---

## 5. 작업이 어느 레포에서 시작/끝나는가

대부분의 변경은 한쪽에서 시작한다. 양쪽이 모두 바뀌어야 하는 경우는
**core가 먼저, siglens가 나중**이다.

| 변경 | core PR | siglens PR | 순서 |
|---|---|---|---|
| 지표/패턴/신호 로직 수정 | ✅ | ❌ | core only |
| AI 프롬프트 문구·구조 변경 | ✅ | ❌ | core only |
| 분석 결과 캐시 키·TTL 정책 변경 | ✅ | ❌ | core only |
| 분석 티어 제한·사용량 규칙 변경 | ✅ | ❌ | core only |
| 새 분석 use-case 함수 추가 (Tier 1) | ✅ (구현·export) | ✅ (호출 지점) | core → siglens |
| 새 분석 직결 외부 시스템 (AI provider 등) | ✅ (factory·인터페이스) | ✅ (factory 호출 지점) | core → siglens |
| 새 시세 프로바이더 추가 | ✅ (인터페이스만 확장 시) | ✅ (실제 fetch 구현) | siglens 단독 가능 |
| 인증·세션·OAuth·이메일·BYOK·문의·한국어 티커·`usage_logs` DB | ❌ | ✅ | siglens only |
| 새 페이지/라우트/컴포넌트 | ❌ | ✅ | siglens only |
| Tailwind/디자인 토큰/SEO | ❌ | ✅ | siglens only |
| 환경변수 추가 (분석용 실제 값) | ❌ (`docs/reference/API.md` 명세만 갱신) | ✅ (`.env`에 값) | core 명세 → siglens 주입 |

---

## 6. 자주 헷갈리는 회색 지대

### "이 화면에 보여줄 데이터를 가공하는 함수는 어디에?"

**판정**: 가공이 분석 비즈니스 규칙이면 core, 단순 표시 포맷이면 siglens.

- "RSI 30 미만이면 oversold로 분류" → core (분석 도메인 규칙)
- "$1234.56을 '$1,234.56'으로 포맷" → siglens (i18n/프레젠테이션)

### "새 환경변수가 필요한데 어디서 읽어야 하나?"

**판정**: 분석 인프라(AI provider key, 분석 캐시 URL 등)를 위한 키/URL이라면
core의 infrastructure에서 읽는다. 인증·이메일·OAuth 같은 일반 백엔드 환경변수는
siglens에서 읽는다.

### "siglens에서 core의 internal 헬퍼가 필요해 보일 때"

**행동**: 절대 deep import하지 않는다. core 레포에 새 public 함수를 추가하는 PR을
먼저 올려 publish한 뒤, siglens가 그 새 심볼을 import한다.

### "기존 core 함수가 약간 부족할 때"

**행동**: siglens 안에서 wrapping/patching하지 않는다. core 함수의 시그니처를
확장(옵셔널 파라미터 추가)하거나 새 변형 함수를 core에 추가한다.

### "분석 use-case가 사용량을 기록해야 한다"

**행동**: core는 `UsageRepository` 인터페이스만 소유한다. Drizzle 구현체는
ejection 이후 siglens가 가지며, factory를 통해 use-case에 주입한다.
IP 해싱 같은 순수 함수는 core(`infrastructure/usage/hash.ts`)에 남는다.

---

## 7. Ejection 로드맵 (Phase 0 ~ Phase 7)

core를 분석 도메인으로 다시 좁히기 위한 단계별 작업.
각 Phase는 별도 PR로 진행하며 순서대로 머지한다.

| Phase | 내용 |
|---|---|
| **Phase 0** | 준비 — `hashUsageIp`를 `infrastructure/usage/`로 분리, 티커 캐시 키를 `tickerCacheKeys.ts`로 분리, SCOPE/PUBLIC_API 문서 갱신. (실제 ejection은 없음) |
| **Phase 1** | 인증·세션·OAuth use-case와 인프라(`application/auth/`, `infrastructure/auth/`, `infrastructure/oauth/`)를 siglens로 환원. core는 `PasswordHasher` 등 인터페이스만 남기거나 전부 제거. |
| **Phase 2** | 이메일 토큰 저장소·발송기(`infrastructure/email/`) 환원. |
| **Phase 3** | BYOK — 사용자 LLM API 키 저장소(`DrizzleUserApiKeyRepository`, `userApiKeys` 스키마, `domain/llm` 검증 유틸의 일부) 환원. |
| **Phase 4** | 한국어 티커 검색·매핑 — `application/ticker/`(특히 `koreanNameStore`, `getAssetInfo`의 한국어 부분), `assetTranslations`/`koreanTickers` 스키마, `KOREAN_NAMES_CACHE_TTL`/`KOREAN_TICKERS_CACHE_KEY`, `infrastructure/cache/tickerCacheKeys.ts` 환원. |
| **Phase 5** | 문의(contact form) — `application/inquiry`, `inquiries` 스키마, `DrizzleInquiryRepository` 환원. |
| **Phase 6** | `usage_logs` DB — `usageLogs` 스키마, `DrizzleUsageRepository`/`DrizzleUsageLogRepository` 환원. core는 `UsageRepository` 인터페이스 + `hashUsageIp`만 보유. |
| **Phase 7** | 사용자 DB 스키마(`users`, `sessions`, `oauth_accounts`)와 `DrizzleUserRepository`/`DrizzleSessionRepository`/`DrizzleOAuthAccountRepository` 환원. core의 `infrastructure/db/`는 분석 use-case가 직접 쓰는 객체만 남거나 사라진다. |

각 Phase 종료 시 SCOPE.md와 PUBLIC_API.md의 인벤토리를 갱신한다.

---

## 8. 참고 문서

| 문서 | 역할 |
|---|---|
| `docs/product/SERVICE.md` | core 라이브러리 전체 개요, 소비자 모델, Skills 시스템 |
| `docs/architecture/ARCHITECTURE.md` | core 내부의 layer 구조와 의존 규칙 |
| `siglens-core/docs/PUBLIC_API.md` | Tier 분류, 인벤토리, semver 정책 |
| `docs/reference/API.md` | core가 호출하는 외부 서비스 명세, 전체 환경변수 목록 |
| `docs/product/DOMAIN.md` | 지표/패턴/신호/Skills의 비즈니스 규칙 |
| `docs/conventions/CONVENTIONS.md` | 네이밍, JSDoc, 코딩 규약 |

---

## 개정 이력

| 일자 | 변경 |
|---|---|
| 2026-05-01 | 최초 작성 — 두 프로젝트의 역할, 의존 방향, 결정 트리, 안티 패턴. |
| 2026-05-02 | core scope를 "분석 도메인 + 분석 직결 인프라 + Skills"로 재정의, ejection 로드맵(Phase 0~7) 추가. |
| 2026-05-02 | Phase 6 ejection 완료 — core는 더 이상 어떤 DB infrastructure도 소유하지 않는다. schema/client/config/constants와 마이그레이션 일체가 siglens로 이전되었으며, core는 추상 repository 인터페이스와 정책 함수만 보유한다. |
| 2026-05-02 | Phase 7(문서 정리) 완료 — Refactoring complete. core scope realigned. Future expansions should consult this document before adding cross-repo functionality. core가 분석 secret sauce와 분석 직결 infrastructure만 소유한다는 원칙은 더 이상 ejection 대상이 아닌 안정 상태(stable steady-state)로 간주한다. |
| 2026-05-02 (Phase 8) | siglens 시점의 작업-경계 체크리스트(§0) 추가. |
