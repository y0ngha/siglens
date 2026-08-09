# Siglens

<div align="center">

**미국 주식과 암호화폐 AI 기술적 분석 — 티커만 넣으면 해석까지.**

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/node-25.2.1-green)

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![English](https://img.shields.io/badge/README-English-white?style=for-the-badge)](https://github.com/y0ngha/siglens/blob/master/README.md)
[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

차트를 본다는 건 보조지표를 하나씩 올리고, 거래량을 확인하고, 패턴을 찾아본 다음 그 전부를 한 번에 판단하는 일입니다. Siglens는 그 해석을 대신합니다.

```text
기존 방식    보조지표 수동 추가 → 거래량 분석 → 패턴 해석 → 종합 판단
Siglens     티커 입력 → 차트·지표 자동 렌더 → AI 종합 리포트 확인
```

`AAPL`을 입력하면 지표가 얹힌 캔들, 패턴 스캔, AI 분석 리포트, 뉴스 다이제스트, 공포탐욕 지수, 종합 시나리오가 한 페이지에 나옵니다. 주식은 펀더멘털·재무제표·의회 거래·옵션 시장까지 확장되고, 암호화폐는 24/7 시장에 맞는 축(차트·뉴스·공포탐욕·종합)에 집중합니다.

**Siglens는 주문을 넣지 않습니다.** 분석만 제공하며, 투자 판단은 읽는 사람 본인의 책임입니다.

현재 **[siglens.io](https://siglens.io)**에서 정식 운영 중입니다. 서비스 UI와 AI 리포트는 모두 한국어이고, 소스 코드와 기본 README는 영어, `docs/` 문서는 한국어로 작성합니다. 이 문서는 [영어 기본 README](./README.md)의 한국어판입니다.

### 목차

[기능](#기능) · [페이지](#페이지) · [시작하기](#시작하기) · [아키텍처](#아키텍처) · [Skills](#skills-시스템) · [운영](#운영) · [문서](#문서) · [테스트](#테스트) · [명령어](#명령어)

---

## 기능

**분석 그 자체**

- **한국어 AI 리포트** — 기술적 신호, 뉴스, 공포탐욕을 통합하고 주식은 펀더멘털·재무제표·옵션·의회 거래까지 확장
- **패턴 감지** — Skills 기반으로 단일/멀티 캔들, 헤드앤숄더, 쐐기, 이중천장·바닥, 삼각수렴, 플래그, 컵앤핸들 판정
- **차트** — Lightweight Charts v5 기반 캔들·거래량·지표 오버레이, 자산별로 달라지는 타임프레임
- **주식 전용 심화** — 밸류에이션과 애널리스트 컨센서스, 손익·재무상태·현금흐름표, Max Pain·Put/Call Ratio·ATM IV·Implied Move가 붙은 옵션 체인, 미국 상하원 공시 흐름

**어떻게 사고할지 고르기**

- **페이지별 모델 선택** — DeepSeek(기본), Claude, Gemini, ChatGPT
- **추론 토글** — 회원은 분석마다 확장 추론을 켜고 끔. 무료 티어는 추론 OFF로 동작
- **BYOK** — Anthropic·Google·OpenAI·DeepSeek 키를 암호화 저장해 본인 쿼터로 호출
- **후속 대화** — 지금 보고 있는 분석 결과를 컨텍스트로 이어서 질문

**내 위치**

- **보유종목** — 심볼·수량·평단을 등록하면 가격대별 거래량 분포에서 내 평단이 어디에 있는지 확인
- **회원가입은 선택** — 핵심 기능은 비회원도 전부 사용. 로그인하면 tier 기반 모델·한도·BYOK가 열림

**시장 전체**

- **섹터 대시보드** — 11개 섹터 대형주 81종목에서 골든크로스·RSI 다이버전스·볼린저 스퀴즈 스캔
- **뉴스 허브** — 미국 일반·주식·암호화폐·외환·마켓 아티클 카테고리별 AI 다이제스트
- **거시경제 대시보드** — 기준금리, CPI, 고용, GDP, 국채금리, 경제 캘린더, AI 브리핑
- **백테스팅** — 2024.11~2026.03 진입 기준 AI 분석 100건의 실제 수익률

<details>
<summary><b>지원 보조지표 전체</b></summary>

RSI · MACD · 볼린저 밴드 · ADX · DMI · Stochastic · StochRSI · CCI · VWAP · MA · EMA · Volume Profile · Ichimoku Cloud · ATR · Donchian Channel · Keltner Channel · SuperTrend · OBV · CMF · MFI · Parabolic SAR · Williams %R · Squeeze Momentum · Smart Money Concepts 등.

계산 명세는 [DOMAIN.md](./docs/product/DOMAIN.md)에 있습니다.

</details>

## 페이지

### 심볼 페이지

| 경로 | 주식 | 암호화폐 | 내용 |
|---|:---:|:---:|---|
| `/[symbol]` | ✓ | ✓ | 차트, 기술적 분석, AI 리포트 |
| `/[symbol]/news` | ✓ | ✓ | 심볼별 뉴스와 AI sentiment |
| `/[symbol]/fear-greed` | ✓ | ✓ | 심볼별 공포탐욕 지수 |
| `/[symbol]/overall` | ✓ | ✓ | 자산이 지원하는 모든 축을 합친 종합 분석 |
| `/[symbol]/position` | ✓ | ✓ | 가격대별 거래량 분포에서 내 평단 위치 |
| `/[symbol]/fundamental` | ✓ | — | 재무, 밸류에이션, 애널리스트 컨센서스 |
| `/[symbol]/financials` | ✓ | — | 손익계산서, 재무상태표, 현금흐름표, 성장률 |
| `/[symbol]/congress` | ✓ | — | 미국 공시 기반 의회 거래 흐름 |
| `/[symbol]/options` | ✓ | — | 옵션 체인, OI 분포, Max Pain, IV 분석 |

### 서비스 페이지

| 경로 | 내용 |
|---|---|
| `/market` | 섹터별 시장 신호 대시보드 |
| `/economy` | 거시경제 지표, 국채금리, 경제 캘린더, AI 브리핑 |
| `/news`, `/news/[category]` | 뉴스 허브 — 일반·주식·암호화폐·외환·마켓 |
| `/backtesting` | AI 분석 백테스팅 결과 |
| `/portfolio` | 등록한 보유종목 관리 |
| `/onboarding` | 가입 직후 보유종목 등록 |
| `/share/[id]` | 공유 가능한 분석 스냅샷 |

<details>
<summary><b>계정·운영 라우트</b></summary>

**계정**

| 경로 | 용도 |
|---|---|
| `/login`, `/signup` | 이메일·OAuth 로그인 / 회원가입 |
| `/signup/oauth/consent` | OAuth 가입 시 약관 동의 단계 |
| `/forgot-password`, `/reset-password` | 이메일 토큰 기반 비밀번호 재설정 |
| `/account` | 계정 설정, tier, BYOK 키 관리 |
| `/account/delete` | 회원 탈퇴 |
| `/terms`, `/privacy` | 이용약관, 개인정보처리방침 |

**운영 엔드포인트**

| 경로 | 용도 |
|---|---|
| `/api/health` | shallow liveness 프로브 — ALB 타깃 그룹이 폴링 |
| `/api/ready` | deep readiness 프로브 (DB·Redis 도달성) |
| `/api/cron/seo-prewarm` | EventBridge가 호출하는 pre-warm 배치 (Bearer `CRON_SECRET`) |
| `/api/sitemap`, `/api/sitemap/{static,popular,crypto,longtail/[page]}` | sitemap 인덱스와 세그먼트 |
| `/api/jobs/cancel` | 진행 중인 분석 Job 취소 |
| `/api/auth/[provider]/start`, `/api/auth/callback/[provider]` | OAuth 시작·콜백 |

</details>

### 데이터 출처

| 데이터 | 출처 | 비고 |
|---|---|---|
| 주식/암호화폐 OHLCV | [Financial Modeling Prep](https://site.financialmodelingprep.com) | 주식 5분봉~일봉, 암호화폐 5분봉·1시간봉·일봉 |
| 펀더멘털, 재무제표, 뉴스, 의회 거래 | FMP `/stable` | 뉴스 sentiment는 Gemini Flash-Lite로 자체 스코어링 |
| 옵션 체인 | yahoo-finance2 | 스냅샷, OI, IV, Greeks |
| 거시경제 | FMP + Siglens DB | 경제 지표, 국채금리, 경제 캘린더 |

## 시작하기

```bash
git clone https://github.com/y0ngha/siglens.git
cd siglens
yarn install          # SIGLENS_GITHUB_TOKEN 필요 — 아래 참고
cp .env.example .env.local
yarn dev              # → http://localhost:4200
```

**Node.js 25.2.1**과 **yarn 4.12.0**이 필요합니다. `yarn install`은 `@y0ngha/siglens-core`를 GitHub Packages에서 받아오므로, 설치 전에 `SIGLENS_GITHUB_TOKEN`이 있어야 합니다.

**없으면 부팅이 안 되는 키:**

| 변수 | 발급처 | 용도 |
|---|---|---|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | 시세, 검색, 펀더멘털, 뉴스 |
| `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 아래 `*_CHAT_API_KEY` 행과 동일한 콘솔 | 분석용 서버사이드 LLM 호출. 이제 앱이 프로바이더를 직접 호출한다(worker 없음). 최소한 기본 분석 모델에 해당하는 키는 있어야 하며, 없으면 첫 분석이 실패한다 |
| `DEEPSEEK_CHAT_API_KEY` | [DeepSeek](https://platform.deepseek.com/api_keys) | DeepSeek 모델 — 기본 분석 프로바이더 |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini 모델, 챗봇, 옵션·뉴스·매크로 해석 |
| `ANTHROPIC_CHAT_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude 모델 |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT 모델 |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | [Upstash](https://upstash.com) | 분석 캐시, 시세 캐시, ISR 태그 스토어 |
| `OAUTH_TOKEN_ENCRYPTION_KEY`, `LLM_API_KEY_ENCRYPTION_KEY`, `OAUTH_STATE_HMAC_SECRET` | `openssl rand -hex 32` | 저장 토큰·사용자 키 암호화, OAuth state 서명 |
| `CRON_SECRET` | 직접 생성 | cron 라우트·액션 보호용 bearer token |
| `SIGLENS_GITHUB_TOKEN` | [GitHub Tokens](https://github.com/settings/tokens) | `@y0ngha/siglens-core` 설치 |

<details>
<summary><b>선택·운영 환경변수</b></summary>

| 변수 | 용도 |
|---|---|
| `UPSTASH_REDIS_REST_READONLY_TOKEN` | Redis readonly 접근 |
| `TRANSLATE_API_KEY` / `TRANSLATE_MODEL` | 한국어 종목명·설명 번역 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 로그인 |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth 로그인 |
| `OAUTH_REDIRECT_BASE_URL` | OAuth redirect 기준 URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | 이메일 발송 |
| `NEXT_PUBLIC_SITE_URL` | 사이트 canonical URL |
| `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_*` / `NEXT_PUBLIC_ADSENSE_ENABLED` | Google AdSense |
| `ISR_CACHE_BUCKET` | S3 기반 ISR/fetch cache handler |
| `ALARM_EMAIL` | CloudWatch 알람 SNS 구독 |
| `DEBUG_VERBOSE_LOGS` | 서버 전용 상세 로그 |

</details>

## 아키텍처

Feature-Sliced Design 6-layer. import는 한 방향으로만 흐릅니다.

```text
app → pages → widgets → features → entities → shared
                                                 ↑
                    @y0ngha/siglens-core — 모든 레이어에서 직접 import 가능
```

```text
siglens/
├── src/
│   ├── app/              Next.js App Router, RSC, route handler
│   ├── views/            FSD pages 레이어 — 페이지 단위 조합
│   ├── widgets/          차트, 분석 패널, 대시보드
│   ├── features/         인증, 검색, 채팅, 보유종목, premium gate
│   ├── entities/         user, session, bars, analysis, ticker, portfolio…
│   └── shared/           공통 UI, config, db, email, api, hooks, lib
├── skills/               분석 기법 Markdown
├── docs/                 아키텍처·제품·도메인·컨벤션 문서
├── e2e/                  Playwright 스펙과 하니스
├── cache-handler/        S3 기반 ISR/fetch cache handler
├── infra/aws/            배포·운영 스크립트
└── refs/                 보조지표·투자 이론 레퍼런스
```

이 트리에서 처음 보면 의외인 지점이 둘 있습니다.

**`pages` 레이어가 `src/views/`에 있습니다.** App Router 프로젝트에 `src/pages/`를 만들면 레거시 Pages Router가 활성화되기 때문에, FSD 레이어 이름만 `views`로 둡니다. 이 매핑은 `eslint.config.mjs`의 `eslint-plugin-boundaries`가 강제하므로 위반은 리뷰가 아니라 빌드에서 걸립니다.

**`@y0ngha/siglens-core`는 외부 라이브러리가 아닙니다.** 지표 계산, 패턴 감지, 시그널 로직, 프롬프트 빌더 — Siglens의 분석 도메인을 그대로 떼어낸 패키지이고, 모든 레이어에서 직접 import할 수 있습니다. 무엇을 코어에 두고 무엇을 여기 둘지는 [SCOPE.md](./docs/architecture/SCOPE.md)에서 판단하고, 레이어 규칙 자체는 [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)에 있습니다.

## Skills 시스템

분석 기법은 코드가 아니라 Markdown입니다.

```text
skills/<category>/my-strategy.md 추가  →  기법이 바로 적용
```

`entities/skill`이 파일을 파싱해 `@y0ngha/siglens-core`의 프롬프트 빌더로 넘기므로, 기법을 추가해도 계산 코드는 건드리지 않습니다. `yarn validate:skills`가 frontmatter 계약을 검증하고, `yarn skills:digest-verify`가 분석 캐시 키에 반영되는 카탈로그 digest를 확인합니다.

| 카테고리 | 내용 |
|---|---|
| `_core/` | 모든 카테고리에 공통 적용되는 규약 |
| `indicators/` | 보조지표 시그널 해석 |
| `patterns/` | 차트 패턴 |
| `strategies/` | 엘리어트 파동, 대순환 분석 |
| `candlesticks/` | 캔들 패턴 교육 |
| `support-resistance/` | 피보나치, 피봇포인트 |
| `fundamental/` | 가치·성장·퀄리티 관점 |
| `news/` | 이벤트 드리븐, 매크로 영향, 어닝 리액션 |

## 운영

배포는 태그 기반입니다. `v*` 태그를 push하면 `.github/workflows/deploy.yml`이 타입체크와 단위 테스트를 게이트로 걸고, 이미지를 빌드해 ECR에 push한 뒤 ASG instance refresh로 롤아웃합니다.

AWS(ALB + ASG/EC2, ECR, SSM, EventBridge, CloudWatch, S3 ISR 캐시) 위에서 Upstash Redis, Neon PostgreSQL, Resend 이메일, 앞단의 Cloudflare, 장시간 AI 작업용 Cloud Run worker와 함께 돌아갑니다.

| 이럴 때 | 이 문서 |
|---|---|
| 배포·롤백, 인시던트 트리아지, 알람 대응 | [DEPLOY_RUNBOOK.md](./docs/architecture/DEPLOY_RUNBOOK.md) |
| AWS 스크립트 실행, 골든 AMI 베이크, env 게이트 통과 | [infra/aws/README.md](./infra/aws/README.md) |
| S3 ISR 캐시·킬 스위치·태그 스토어 작업 | [ISR_CACHE_HANDLER.md](./docs/architecture/ISR_CACHE_HANDLER.md) |
| 페이지 revalidate 주기 변경 | [ISR_REVALIDATE.md](./docs/architecture/ISR_REVALIDATE.md) |
| Cloudflare 캐싱·WAF·봇 보호 조정 | [CDN_CACHING.md](./docs/architecture/CDN_CACHING.md) |
| pre-warm 크론과 알람 손보기 | [CRON.md](./docs/reference/CRON.md) |

## 문서

전체 인덱스는 **[docs/README.md](./docs/README.md)**. 가장 먼저 찾게 되는 것들:

| 문서 | 내용 |
|---|---|
| [SERVICE.md](./docs/product/SERVICE.md) | 서비스 개요, 대상 사용자, Skills 시스템 |
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | 레이어 구조, 의존성 규칙, 데이터 흐름 |
| [SCOPE.md](./docs/architecture/SCOPE.md) | siglens와 siglens-core의 책임 분리 |
| [DOMAIN.md](./docs/product/DOMAIN.md) | 지표 명세, 캔들 패턴, 비즈니스 규칙 |
| [AUTH.md](./docs/product/AUTH.md) | 인증, 세션, OAuth, 이메일 토큰 |
| [API.md](./docs/reference/API.md) | 데이터·AI API와 환경변수 |
| [CONVENTIONS.md](./docs/conventions/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 테스트 정책 |
| [E2E.md](./docs/qa/E2E.md) | Playwright 하니스, 로컬·CI 실행, 스펙 작성 |
| [DESIGN.md](./docs/conventions/DESIGN.md) | 컬러 시스템, Tailwind 테마, 차트 상수 |
| [GIT_CONVENTIONS.md](./docs/conventions/GIT_CONVENTIONS.md) | 브랜치·커밋·PR 규칙 |
| [MISTAKES.md](./docs/workflows/MISTAKES.md) | 반복 실수와 방지법 |
| [SECURITY.md](./SECURITY.md) | 취약점 신고 |

## 테스트

```bash
yarn test            # Vitest 전체
yarn test-coverage   # 커버리지 포함
yarn test:e2e        # Playwright
```

Vitest 테스트 파일 약 1,000개, Playwright 스펙 41개. 커버리지 목표는 **90%**이고 측정 대상은 `entities/`, `features/`, `shared/`, `widgets/`, `app/`, `src/proxy.ts`, `cache-handler/`다. 마지막 것은 `src/` 밖에 있지만 프로덕션 코드이고, 빼두면 커버리지가 조용히 썩기 때문에 포함한다. `src/views/`는 현재 측정 대상에 없다.

E2E는 실제 프로덕션 빌드를 브라우저로 검증하며 Vitest와 별도로 돕니다([E2E.md](./docs/qa/E2E.md)). 참고로 `git push`는 Husky 게이트를 발화해 format check·lint·typecheck·단위 테스트·프로덕션 빌드를 전부 돌리므로 시간이 꽤 걸립니다.

## 명령어

자주 쓰는 것:

```bash
yarn dev             # :4200 개발 서버
yarn build           # 프로덕션 빌드
yarn lint            # ESLint          (자동 수정은 lint:fix)
yarn typecheck       # tsgo            (tsc는 typecheck:tsc)
yarn format          # Prettier        (검사만 하면 format:check)
yarn test            # Vitest
```

패키지 설치는 항상 `yarn`입니다. `npm`과 `pnpm`은 사용하지 않습니다.

<details>
<summary><b>package.json scripts 전체</b></summary>

| 명령 | 용도 |
|---|---|
| `yarn dev` | Turbopack 개발 서버, port 4200 |
| `yarn build` | 프로덕션 빌드 |
| `yarn analyze` | bundle analyzer 활성화 빌드 |
| `yarn start` | Next.js production server |
| `yarn clear:build` | `.next` 산출물 삭제 |
| `yarn copy:backtesting` | 백테스팅 JSON을 `public/backtesting`으로 복사 |
| `yarn clear:backtesting` | `public/backtesting` 생성물 삭제 |
| `yarn predev` / `yarn prebuild` | dev·build 전 백테스팅 파일 재생성 |
| `yarn lint` | ESLint |
| `yarn lint:fix` | ESLint 자동 수정 |
| `yarn lint:staged` | staged 파일 ESLint 자동 수정 |
| `yarn lint:style` | Stylelint |
| `yarn lint:style-fix` | Stylelint 자동 수정 |
| `yarn format` | Prettier write |
| `yarn format:staged` | staged 파일 Prettier |
| `yarn format:check` | Prettier check |
| `yarn typecheck` | `tsgo` 타입체크 |
| `yarn typecheck:tsc` | `tsc` 타입체크 |
| `yarn db:generate` | Drizzle migration 생성 |
| `yarn db:migrate` | migration 실행 |
| `yarn db:seed:terms` | 약관 데이터 seed |
| `yarn db:migrate:tickers` | 한국어 ticker 데이터 seed/update |
| `yarn db:seed:crypto` | FMP crypto universe를 `crypto_assets`에 적재 |
| `yarn db:seed:crypto-korean` | 암호화폐 한국어 이름 seed |
| `yarn db:backfill:calendar` | 경제 캘린더 backfill |
| `yarn db:seed:calendar-analysis` | 경제 캘린더 분석 seed |
| `yarn db:seed:calendar-analysis:batch` | 캘린더 분석 batch seed |
| `yarn db:seed:indicator-translations:batch` | 지표 번역 batch seed |
| `yarn test` | Vitest 전체 |
| `yarn test:quiet` | Vitest dot reporter |
| `yarn test:related` | 변경 관련 Vitest |
| `yarn test-watch` | Vitest watch mode |
| `yarn test-coverage` | Vitest coverage |
| `yarn test-coverage-watch` | coverage watch mode |
| `yarn test-coverage-report` | 상세 coverage report |
| `yarn e2e` | E2E 하니스 스크립트 |
| `yarn e2e:up` / `yarn e2e:down` | E2E Compose 스택 시작 / 정리 |
| `yarn e2e:db` | E2E DB global setup |
| `yarn test:e2e` | Playwright 실행 |
| `yarn test:e2e:ui` | Playwright UI mode |
| `yarn validate:skills` | Skills Markdown 검증 |
| `yarn skills:digest-verify` | Skills digest 검증 |
| `yarn skills:digest-update` | Skills digest metadata 갱신 |
| `yarn prepare` | Husky hook 설치 |
| `yarn release` | release-it |
| `yarn release:patch` / `:minor` / `:major` | 버전별 릴리스 |
| `yarn fetch-this-week-tasks` | 이번 주 작업 fetch 스크립트 |
| `yarn update-popular-tickers` | 인기 ticker 목록 갱신 |
| `yarn update-popular-cryptos` | 인기 crypto 목록 갱신 |

</details>

## 보안

취약점은 공개 이슈로 올리지 말아주세요 — 신고 절차는 [SECURITY.md](./SECURITY.md)에 있습니다.

## 기여

외부 코드 기여는 아직 정식으로 열려 있지 않습니다. 버그 리포트와 제안은 [Issues](https://github.com/y0ngha/siglens/issues)로 환영합니다.

Skills도 아직 공개된 리뷰·머지 워크플로가 없습니다. Markdown 파일 하나로 분석이 확장되도록 의도적으로 설계했으니, frontmatter 표준과 검증 절차가 정리되면 기여 가이드를 공개할 예정입니다.

## 라이선스

[MIT License](./LICENSE)

---

<div align="center">

**[맨 위로](#siglens)** · **[English README](https://github.com/y0ngha/siglens/blob/master/README.md)**

</div>
