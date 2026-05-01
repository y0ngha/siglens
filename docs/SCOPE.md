# Project Scope — `siglens` vs `siglens-core`

> 이 문서는 **양쪽 프로젝트가 공유하는 단일 source-of-truth**다.
> `siglens-core`와 `siglens` 양쪽 레포에 동일한 파일이 존재한다.
> 분담에 대한 모든 결정을 변경할 때는 **두 레포 모두** 동시에 갱신한다.

---

## 1. 두 프로젝트의 역할

### `@y0ngha/siglens-core` — 라이브러리

**한 줄 정의**: "프레임워크에 종속되지 않는 비즈니스 로직 + 외부 시스템 래퍼."

```
- 무엇을 담는가:
  · 도메인 계산 (지표, 캔들/차트 패턴, 분석 프롬프트 빌더, 신호 감지)
  · 외부 I/O 래퍼 (AI provider, Upstash Redis, Neon Postgres, Skills 파일 로더)
  · use-case 함수 (인증, 분석 제출/폴링, 대시보드 집계, 채팅 등 — `application/`)
  · 위 모든 항목의 공개 타입과 상수

- 무엇을 담지 않는가:
  · UI/렌더링/CSS/이미지/폰트
  · React, Next.js, 라우팅, 미들웨어
  · 시세 프로바이더(FMP, Alpaca)의 실제 호출 코드 — 인터페이스만 소유
  · 사용자별 설정 화면, 관리자 화면, 결제, 마케팅 페이지
  · 빌드된 산출물(`dist/`)을 npm 패키지로 배포 — 그 자체가 산출물
```

### `siglens` — 소비자(웹 앱)

**한 줄 정의**: "siglens-core를 호출해 사용자에게 화면을 보여주는 Next.js 앱."

```
- 무엇을 담는가:
  · UI 컴포넌트, 페이지, 레이아웃, 차트 렌더링, 디자인 시스템
  · Next.js Server Action / Route Handler / Middleware
  · 인증 쿠키 set/clear (siglens-core가 반환한 메타데이터를 실제 Response에 적용)
  · MarketDataProvider 구현체 — FMP/Alpaca 같은 시세 API의 실제 fetch 코드
  · 환경변수 주입 (siglens-core는 process.env를 읽지만, 값을 채우는 책임은 consumer)
  · 사용자 인터랙션, 폼, 에러 토스트, 로딩 스피너
  · OAuth 콜백 라우트, 비밀번호 재설정 URL 구성
  · 페이지 SEO, 메타데이터, 사이트맵
  · siglens-core가 노출하지 않는 "프레젠테이션 전용 가공" (문자열 포맷, i18n)

- 무엇을 담지 않는가:
  · 지표 계산식, 캔들 패턴 판정 로직, 신호 감지 임계값 — core에만 존재
  · AI 프롬프트 문자열 조립 — core의 `buildAnalysisPrompt` 등을 호출
  · DB 스키마 정의, 마이그레이션, Drizzle 쿼리 — core가 소유
  · 캐시 키 포맷, TTL 정책, Job 큐 라이프사이클 — core가 소유
  · 비즈니스 규칙(티어 제한, 사용량 카운트, 쿨다운) — core가 소유
```

---

## 2. 의존 방향

```
siglens (Next.js 앱)
    │
    │  import from '@y0ngha/siglens-core'
    ▼
siglens-core (npm 패키지)
    │
    └── domain → infrastructure → application
        (레이어 의존 규칙은 docs/ARCHITECTURE.md 참고)
```

**규칙**

- `siglens` → `siglens-core` 단방향만 허용한다.
- `siglens-core`는 `siglens`의 존재를 모른다. core 안에 "siglens에서는 …" 같은 분기 코드가 들어가면 안 된다.
- `siglens`는 **`src/index.ts`에서 export된 심볼만** import한다. deep import (`@y0ngha/siglens-core/dist/...`)는 금지. 자세한 정책은 `docs/PUBLIC_API.md`.
- core가 새 기능을 노출해야 `siglens`가 쓸 수 있다. 따라서 작업 순서는 **core 먼저, siglens 나중**이 기본이다.

---

## 3. 결정 트리 — "이 코드 어디에 둘까?"

새 코드를 짤 때 다음 5단계를 순서대로 적용한다. **첫 YES에서 멈춘다.**

### Step 1 — DOM/React/Next.js를 직접 만지는가?

```
컴포넌트, JSX, useState, headers(), cookies(), redirect(),
NextResponse, "use client", "use server", CSS, 이미지 import
```

**YES → `siglens`로 간다.** core는 이런 것을 절대 import하지 않는다.

### Step 2 — 외부 시세 API(FMP, Alpaca 등)를 직접 호출하는가?

```
fetch('https://financialmodelingprep.com/...')
fetch('https://data.alpaca.markets/...')
```

**YES → `siglens`로 간다.** core는 `MarketDataProvider` 인터페이스만 소유한다.
실제 fetch 코드는 `siglens` 측에서 구현해 core 함수에 주입한다.

> 예외: `infrastructure/fmp/config.ts`처럼 환경변수 reader는 core에 있을 수 있다.
> 그러나 시세를 가져오는 fetch 자체는 core에 두지 않는다.

### Step 3 — 도메인 계산이거나, AI 프롬프트 조립이거나, 비즈니스 규칙인가?

```
지표 계산식 (RSI, MACD, …)
캔들/차트 패턴 판정
티어별 제한, 사용량 카운트, 쿨다운
AI 프롬프트 빌더 (buildAnalysisPrompt 등)
응답 정규화 (normalize*, enrich*, filter*)
```

**YES → `siglens-core`의 `domain/` 또는 `application/`로 간다.**
이런 코드가 `siglens`에 생기면 두 가지 문제가 생긴다.
(1) 워커/CLI 등 다른 consumer가 같은 로직을 재구현해야 한다.
(2) 비즈니스 규칙이 두 곳에 흩어져 일관성이 깨진다.

### Step 4 — 외부 시스템(AI, Redis, Postgres, Filesystem)에 I/O가 발생하는가?

```
Anthropic/Gemini SDK 호출
Upstash Redis 명령
Neon Postgres 쿼리, Drizzle 마이그레이션
skills/*.md 파일 읽기
```

**YES → `siglens-core`의 `infrastructure/`로 간다.**
core는 모든 I/O를 인터페이스 뒤에 숨긴다. `siglens`는 factory 함수
(`createCacheProvider`, `createDatabaseClient`, `FileSkillsLoader` 등)를
호출해 인스턴스를 받아 쓰기만 한다.

> 예외: 인증 쿠키 헤더를 실제 Response에 set/clear하는 작업은 `siglens`다.
> core는 "어떤 쿠키를 어떤 옵션으로 설정해야 하는가"라는 메타데이터만 반환한다.

### Step 5 — 위 어디에도 해당하지 않는가?

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

❌ core 안에서 fetch를 호출해 FMP/Alpaca 시세를 직접 가져옴
   → MarketDataProvider 인터페이스로 추상화. 구현은 consumer.

❌ core 안에서 "siglens 앱에서는 이렇게…" 같은 조건 분기
   → core는 자신의 consumer를 모른다. 일반화된 옵션으로 표현한다.

❌ Tier 1~4가 아닌 internal 함수를 src/index.ts에서 export
   → 우회 import 차단. PUBLIC_API.md 따름.
```

### siglens 쪽

```
❌ deep import: '@y0ngha/siglens-core/dist/domain/...'
   → 다음 minor 버전에서 깨진다. src/index.ts public API만 사용.

❌ siglens 내부에 RSI 계산식, 캔들 패턴 임계값, AI 프롬프트 문자열을 복제
   → core에 같은 함수가 있다. 없다면 core에 PR을 올려 추가한 뒤 import.

❌ siglens 내부에 Drizzle schema, 캐시 키 빌더, Job 큐 키 패턴 정의
   → 모두 core가 source-of-truth.

❌ siglens 내부에서 process.env를 읽어 core 함수에 "옵션 객체"로 다시 넣어 전달
   → core의 infrastructure가 직접 process.env를 읽도록 설계되어 있다.
     consumer는 .env 값을 채우기만 하면 된다.
     (예외: 채팅 Gemini key fallback처럼 core가 명시적으로 string config을
      파라미터로 받는 경우만 consumer가 주입한다.)

❌ siglens가 core의 internal 헬퍼(예: 개별 detectRsiOversold)를 흉내 내어 재구현
   → 통합 진입점(detectSignals)을 사용한다. 부족하면 core를 확장한다.
```

---

## 5. 작업이 어느 레포에서 시작/끝나는가

대부분의 변경은 한쪽에서 시작한다. 양쪽이 모두 바뀌어야 하는 경우는 **core가 먼저, siglens가 나중**이다.

| 변경 | core PR | siglens PR | 순서 |
|---|---|---|---|
| 지표/패턴/신호 로직 수정 | ✅ | ❌ | core only |
| AI 프롬프트 문구·구조 변경 | ✅ | ❌ | core only |
| DB 스키마 변경 / 마이그레이션 | ✅ | ❌ | core only |
| 캐시 키·TTL 정책 변경 | ✅ | ❌ | core only |
| 티어 제한·사용량 규칙 변경 | ✅ | ❌ | core only |
| 새 use-case 함수 추가 (Tier 1) | ✅ (구현·export) | ✅ (호출하는 화면/액션) | core → siglens |
| 새 외부 시스템 연동 (Redis/DB/AI) | ✅ (factory·인터페이스) | ✅ (factory 호출 지점) | core → siglens |
| 새 시세 프로바이더 추가 | ✅ (인터페이스만 확장 시) | ✅ (실제 fetch 구현) | siglens 단독 가능 |
| 새 페이지/라우트/컴포넌트 | ❌ | ✅ | siglens only |
| Tailwind/디자인 토큰/SEO | ❌ | ✅ | siglens only |
| OAuth provider 연결 화면 | ❌ | ✅ | siglens only |
| 환경변수 추가 (실제 값) | ❌ (`docs/API.md` 명세만 갱신) | ✅ (`.env`에 값) | core 명세 → siglens 주입 |

---

## 6. 자주 헷갈리는 회색 지대

### "이 화면에 보여줄 데이터를 가공하는 함수는 어디에?"

**판정**: 가공이 비즈니스 규칙이면 core, 단순 표시 포맷이면 siglens.

- "RSI 30 미만이면 oversold로 분류" → core (도메인 규칙)
- "$1234.56을 '$1,234.56'으로 포맷" → siglens (i18n/프레젠테이션)

### "새 환경변수가 필요한데 어디서 읽어야 하나?"

**판정**: 외부 시스템에 접속하기 위한 키/URL이라면 core의 infrastructure에서 읽는다.
순전히 UI 동작을 토글하는 플래그(예: 메인터넌스 배너)는 siglens에서 읽는다.

### "siglens에서 core의 internal 헬퍼가 필요해 보일 때"

**행동**: 절대 deep import하지 않는다. core 레포에 새 public 함수를 추가하는 PR을 먼저 올려 publish한 뒤, siglens가 그 새 심볼을 import한다.

### "기존 core 함수가 약간 부족할 때"

**행동**: siglens 안에서 wrapping/patching하지 않는다. core 함수의 시그니처를 확장(옵셔널 파라미터 추가)하거나 새 변형 함수를 core에 추가한다.

---

## 7. 참고 문서

| 문서 | 역할 |
|---|---|
| `docs/SERVICE.md` | core 라이브러리 전체 개요, 소비자 모델, Skills 시스템 |
| `docs/ARCHITECTURE.md` | core 내부의 layer 구조와 의존 규칙 |
| `docs/PUBLIC_API.md` | Tier 분류, 인벤토리, semver 정책 |
| `docs/API.md` | core가 호출하는 외부 서비스 명세, 전체 환경변수 목록 |
| `docs/DOMAIN.md` | 지표/패턴/신호/Skills의 비즈니스 규칙 |
| `docs/CONVENTIONS.md` | 네이밍, JSDoc, 코딩 규약 |

---

## 개정 이력

| 일자 | 변경 |
|---|---|
| 2026-05-01 | 최초 작성 — 두 프로젝트의 역할, 의존 방향, 결정 트리, 안티 패턴. |
