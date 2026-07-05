# Siglens

<div align="center">

![Status](https://img.shields.io/badge/status-production-brightgreen)
![License](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue)

![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat&logo=amazonaws&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash-00E9A3?style=flat&logo=upstash&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=flat&logo=neon&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-000000?style=flat&logo=resend&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)

![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D25.2.1-green)

## 미국 주식과 암호화폐 AI 기술적 분석 플랫폼

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![English](https://img.shields.io/badge/README-English-white?style=for-the-badge)](https://github.com/y0ngha/siglens/blob/master/README.en.md)
[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

## What Is Siglens?

Siglens는 미국 주식과 암호화폐의 기술적 분석을 AI가 대신 정리해주는 분석 전용 서비스입니다.

이동평균, MACD, RSI, 볼린저 밴드, DMI, 캔들 패턴, 차트 패턴처럼 여러 지표를 동시에 해석해야 하는 작업을 자동화합니다. 사용자는 티커를 입력하면 차트, 인디케이터, AI 분석 리포트, 뉴스 요약, 공포탐욕 지수, 종합 시나리오를 한 화면에서 확인할 수 있습니다.

주식은 펀더멘털, 재무제표, 의회 거래, 옵션 시장까지 함께 다룹니다. 암호화폐는 24/7 시장 특성에 맞춰 차트, 뉴스, 공포탐욕, 종합 분석 중심으로 제공합니다.

```text
기존 방식    보조지표 수동 추가 -> 거래량 분석 -> 패턴 해석 -> 종합 판단
Siglens     티커 입력 -> 차트/지표 자동 렌더 -> AI 종합 분석 리포트
```

Siglens는 주문 기능을 제공하지 않습니다. 분석 정보만 제공하며, 투자 결정은 사용자 본인의 책임입니다.

## Status

Siglens는 현재 [siglens.io](https://siglens.io)에서 정식 배포 중입니다.

## Core Features

- 차트: Lightweight Charts v5 기반 캔들, 거래량, 보조지표 렌더링과 자산별 멀티 타임프레임
- 자산 지원: 미국 상장 주식/ETF/지수와 주요 암호화폐 심볼 검색 및 분석
- 인디케이터: RSI, MACD, 볼린저 밴드, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud, ATR, Donchian/Keltner Channel, SuperTrend, OBV, CMF, MFI, Parabolic SAR, Williams %R, Squeeze Momentum, Smart Money Concepts 등
- 캔들/차트 패턴: 단일 캔들 15종, 멀티 캔들 30종, 헤드앤숄더, 쐐기, 이중천장/바닥, 삼각수렴, 플래그, 컵앤핸들 등 Skills 기반 감지
- AI 종합 분석: 기술적 분석, 뉴스, 공포탐욕을 통합하고 주식은 펀더멘털/재무제표/옵션/의회 거래까지 확장한 한국어 리포트
- 주식 전용 분석: 펀더멘털, 재무제표, 애널리스트 컨센서스, 옵션 체인, Max Pain, Put/Call Ratio, ATM IV, Implied Move, 의회 거래 흐름
- AI 모델 선택: Claude, Gemini, ChatGPT 모델을 페이지별로 선택
- BYOK: Anthropic, Google, OpenAI API Key를 사용자 계정에 암호화 저장해 자체 키로 호출
- 회원 기능: 비회원 기본 사용, 회원 가입 시 tier 기반 모델/한도/BYOK 기능 제공
- AI 챗봇: 분석 결과를 컨텍스트로 이어가는 자연어 후속 질문
- 시장 현황 대시보드: 11개 섹터 200+ 종목의 골든크로스, RSI 다이버전스, 볼린저 스퀴즈 스캔
- 마켓 뉴스 허브: 미국 일반, 주식, 암호화폐, 외환, 마켓 아티클 카테고리별 AI 뉴스 다이제스트
- 거시경제 대시보드: 미국 기준금리, CPI, 고용, GDP, 국채금리, 경제 캘린더와 AI 매크로 브리핑
- AI 백테스팅: 2024.04~2026.04 기간의 분석 결과 100건에 대한 실제 수익률 검증

## Main Pages

### Symbol Pages

| 경로 | 주식 | 암호화폐 | 설명 |
|---|---:|---:|---|
| `/[symbol]` | O | O | 차트, 기술적 분석, AI 리포트 |
| `/[symbol]/news` | O | O | 심볼별 뉴스와 AI sentiment 분석 |
| `/[symbol]/fear-greed` | O | O | 심볼별 공포탐욕 지수 |
| `/[symbol]/overall` | O | O | 자산별 지원 데이터 축을 합친 종합 분석 |
| `/[symbol]/fundamental` | O | - | 재무, 밸류에이션, 애널리스트 컨센서스 기반 펀더멘털 분석 |
| `/[symbol]/financials` | O | - | 손익계산서, 재무상태표, 현금흐름표와 성장률 분석 |
| `/[symbol]/congress` | O | - | 미국 상하원 거래 공시 기반 의회 거래 흐름 분석 |
| `/[symbol]/options` | O | - | 옵션 체인, OI 분포, Max Pain, IV 기반 분석 |

### Product Pages

| 경로 | 설명 |
|---|---|
| `/market` | 섹터별 시장 신호 대시보드 |
| `/economy` | 미국 거시경제 지표, 국채금리, 경제 캘린더, AI 매크로 브리핑 |
| `/news` | 카테고리별 마켓 뉴스 허브 |
| `/news/[category]` | 일반, 주식, 암호화폐, 외환, 마켓 뉴스 카테고리 상세 |
| `/backtesting` | AI 분석 백테스팅 결과 |
| `/share/[id]` | 공유 가능한 분석 스냅샷 |

## Data Sources

| 데이터 | 출처 | 비고 |
|---|---|---|
| 주식/암호화폐 OHLCV | [Financial Modeling Prep](https://site.financialmodelingprep.com) | 주식 5분봉~일봉, 암호화폐 5분봉/1시간봉/일봉 |
| 주식 펀더멘털 | FMP `/stable` API | PER, ROE, EPS, 컨센서스, 목표가, peer/sector 데이터 |
| 재무제표 | FMP `/stable` API | 손익계산서, 재무상태표, 현금흐름표, 성장률 |
| 뉴스/어닝 | FMP `/stable` API | 주식/암호화폐 뉴스 sentiment는 Gemini Flash-Lite로 자체 분석 |
| 의회 거래 | FMP `/stable` API | Senate/House disclosure 기반 거래 내역 |
| 옵션 체인 | yahoo-finance2 | 주식 옵션 스냅샷, OI, IV, Greeks |
| 거시경제 | FMP + Siglens DB | 미국 경제 지표, 국채금리, 경제 캘린더 |

## External Services

주요 외부 인프라 의존성은 다음과 같습니다.

| 서비스 | 용도 |
|---|---|
| AWS | ALB, ASG/EC2, ECR, SSM Parameter Store, CloudWatch Logs/Alarms, S3 ISR cache |
| Upstash | Redis 기반 분석 캐시, Job 상태, 이메일/인증 토큰 저장 |
| Neon | PostgreSQL 데이터베이스 |
| Resend | 이메일 인증과 비밀번호 재설정 메일 발송 |
| Cloudflare | DNS, edge 보안, 캐시/트래픽 관리, Web Analytics |
| Google Cloud Run worker | 장시간 AI 분석 worker 호출 |

## Tech Stack

| 영역 | 기술 |
|---|---|
| Framework | Next.js 16.2, App Router, Turbopack, React Compiler |
| UI | React 19.2, Tailwind CSS 4 |
| Chart | Lightweight Charts v5, 자체 SVG 옵션 OI 차트 |
| State | TanStack Query v5 |
| AI | Anthropic Claude, Google Gemini, OpenAI ChatGPT |
| Auth | bcryptjs, Google OAuth, Kakao OAuth, 암호화 세션 쿠키 |
| Database | Drizzle ORM, Neon PostgreSQL |
| Cache | Upstash Redis, Next.js ISR/Data Cache, S3 cache handler |
| Testing | Vitest, Testing Library, jsdom, Playwright |
| Language | TypeScript 5 |
| Package Manager | yarn 4.12.0 |
| Runtime | Node.js 25.2.1 |
| Deploy | AWS ALB + ASG/EC2 + ECR, Cloudflare, Cloud Run worker |

## Quick Start

### Prerequisites

```bash
Node.js 25.2.1
yarn 4.12.0
```

### Installation

```bash
git clone https://github.com/y0ngha/siglens.git
cd siglens
yarn install
```

### Environment

```bash
cp .env.example .env.local
```

필수 환경변수:

| 변수 | 발급처 | 용도 |
|---|---|---|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | 주식/암호화폐 시세, 검색, 펀더멘털, 뉴스 데이터 |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini 모델, 챗봇, 옵션/뉴스/매크로 해석 |
| `ANTHROPIC_CHAT_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude 모델 |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT 모델 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://upstash.com) | Redis 캐시와 Job 상태 |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL |
| `OAUTH_TOKEN_ENCRYPTION_KEY` / `LLM_API_KEY_ENCRYPTION_KEY` | `openssl rand -hex 32` | DB 저장 OAuth token/API key 암호화 |
| `OAUTH_STATE_HMAC_SECRET` | `openssl rand -hex 32` | OAuth state cookie 서명 |
| `CRON_SECRET` | 직접 생성 | cron/action 보호용 bearer token |
| `SIGLENS_GITHUB_TOKEN` | [GitHub Tokens](https://github.com/settings/tokens) | `@y0ngha/siglens-core` 설치용 GitHub Packages token |

선택/운영 환경변수:

| 변수 | 용도 |
|---|---|
| `UPSTASH_REDIS_REST_READONLY_TOKEN` | Redis readonly 접근 |
| `TRANSLATE_API_KEY` / `TRANSLATE_MODEL` | 한국어 종목명/설명 번역 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 로그인 |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth 로그인 |
| `OAUTH_REDIRECT_BASE_URL` | OAuth redirect 기준 URL |
| `RESEND_API_KEY` / `EMAIL_FROM` | 이메일 발송 |
| `NEXT_PUBLIC_SITE_URL` | 사이트 canonical URL |
| `NEXT_PUBLIC_ADSENSE_*` | Google AdSense |
| `WORKER_URL` / `WORKER_SECRET` | Cloud Run worker 호출 |
| `ISR_CACHE_BUCKET` | AWS S3 기반 ISR/fetch cache handler |
| `ALARM_EMAIL` | CloudWatch alarm SNS 이메일 구독 |
| `DEBUG_VERBOSE_LOGS` | 서버 전용 상세 디버그 로그 |

### Development Server

```bash
yarn dev
```

http://localhost:4200 접속

## Architecture

Siglens는 Feature-Sliced Design 6-layer 구조를 사용합니다.

```text
app -> pages -> widgets -> features -> entities -> shared
                                                   ^
                           @y0ngha/siglens-core는 모든 레이어에서 직접 import 가능
```

```text
siglens/
├── src/
│   ├── app/              Next.js App Router, RSC, Route Handler
│   ├── widgets/          차트, 분석 패널, 대시보드, 페이지 조합 UI
│   ├── features/         인증, 검색, 채팅, premium gate 등 사용자 기능
│   ├── entities/         user, session, bars, analysis, ticker 등 도메인 엔티티
│   └── shared/           공통 UI, config, db, email, api, hooks, lib
├── skills/               분석 기법 정의 Markdown
├── docs/                 아키텍처, 도메인, 컨벤션 문서
├── infra/aws/            AWS 배포와 운영 스크립트
└── refs/                 보조지표와 투자 이론 레퍼런스
```

분석 도메인 로직의 본체는 `@y0ngha/siglens-core` 패키지에 있습니다. 이 패키지는 일반 외부 라이브러리가 아니라 Siglens 분석 로직을 분리한 코어 패키지이므로 모든 FSD 레이어에서 직접 import할 수 있습니다.

자세한 규칙은 [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)와 [SCOPE.md](./docs/architecture/SCOPE.md)를 참고하세요.

## Skills System

분석 기법은 코드가 아니라 `skills/` 디렉터리의 Markdown 파일로 정의합니다.

```text
/skills/<category>/my-strategy.md 파일 추가 -> 새로운 분석 기법 적용
```

`entities/skill`이 Markdown 파일을 읽고, 파싱된 Skill 데이터가 `@y0ngha/siglens-core`의 프롬프트 빌더에 전달됩니다. 도메인 계산식을 수정하지 않고도 분석 기법을 추가하거나 보완할 수 있습니다.

현재 카테고리:

- `skills/patterns/`: 차트 패턴
- `skills/indicators/`: 보조지표 시그널 해석
- `skills/strategies/`: 엘리어트 파동, 대순환 분석 등
- `skills/support-resistance/`: 피보나치, 피봇포인트
- `skills/candlesticks/`: 캔들 패턴 교육
- `skills/fundamental/`: 가치, 성장, 퀄리티 투자 관점
- `skills/news/`: 이벤트 드리븐, 매크로 영향, 어닝 리액션

## Documentation

| 문서 | 내용 |
|---|---|
| [SERVICE.md](./docs/product/SERVICE.md) | 서비스 개요, 대상 사용자, 기술 스택, Skills 시스템 |
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | FSD 레이어 구조, 의존성 규칙, 데이터 흐름 |
| [SCOPE.md](./docs/architecture/SCOPE.md) | siglens와 siglens-core의 책임 분리 |
| [AUTH.md](./docs/product/AUTH.md) | 인증, 세션, OAuth, 이메일 토큰 흐름 |
| [DOMAIN.md](./docs/product/DOMAIN.md) | 인디케이터 계산 명세, 캔들 패턴, Skills 시스템 |
| [API.md](./docs/reference/API.md) | 데이터/AI API와 환경변수 |
| [CONVENTIONS.md](./docs/conventions/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 테스트 정책 |
| [E2E.md](./docs/qa/E2E.md) | Playwright E2E 하니스 구조, 로컬/CI 실행, 스펙 작성 가이드 |
| [DESIGN.md](./docs/conventions/DESIGN.md) | 컬러 시스템, Tailwind 설정, 차트 컬러 상수 |
| [GIT_CONVENTIONS.md](./docs/conventions/GIT_CONVENTIONS.md) | 브랜치, 커밋 메시지, PR 규칙 |
| [MISTAKES.md](./docs/workflows/MISTAKES.md) | 반복 실수와 방지 규칙 |
| [infra/aws/README.md](./infra/aws/README.md) | AWS 운영 스크립트와 배포 절차 |

## Testing

```bash
yarn test                    # 전체 테스트
yarn test-watch              # watch
yarn test-coverage           # 커버리지 포함
yarn test-coverage-report    # 상세 커버리지 리포트
yarn test:e2e                # Playwright E2E
```

커버리지 목표는 전체 FSD 레이어 기준 90%입니다. 현재 Vitest 설정은 `entities/`, `features/`, `shared/`, `widgets/`, `app/`, `src/proxy.ts`를 커버리지 측정 대상으로 포함합니다.

실제 브라우저로 사용자 여정을 검증하는 Playwright E2E 스위트는 Vitest 위에 별도로 올라갑니다. 하니스 구조와 로컬/CI 실행 방법은 [E2E.md](./docs/qa/E2E.md)를 참고하세요.

## Commands

`package.json`의 scripts 전체 목록입니다.

| 명령 | 용도 |
|---|---|
| `yarn copy:backtesting` | 백테스팅 JSON을 `public/backtesting`으로 복사 |
| `yarn clear:backtesting` | `public/backtesting` 생성물을 삭제 |
| `yarn predev` | 개발 서버 시작 전 백테스팅 파일 재생성 |
| `yarn prebuild` | 빌드 전 백테스팅 파일 재생성 |
| `yarn clear:build` | `.next` 빌드 산출물 삭제 |
| `yarn dev` | Turbopack 개발 서버 실행, port 4200 |
| `yarn build` | 프로덕션 빌드 |
| `yarn analyze` | bundle analyzer 활성화 빌드 |
| `yarn start` | Next.js production server 실행 |
| `yarn lint` | ESLint 검사 |
| `yarn lint:fix` | ESLint 자동 수정 |
| `yarn lint:staged` | staged 파일용 ESLint 자동 수정 |
| `yarn lint:style` | Stylelint 검사 |
| `yarn lint:style-fix` | Stylelint 자동 수정 |
| `yarn db:generate` | Drizzle migration 생성 |
| `yarn db:migrate` | DB migration 실행 |
| `yarn db:seed:terms` | 약관 데이터 seed |
| `yarn db:migrate:tickers` | 한국어 ticker 데이터 seed/update |
| `yarn db:seed:crypto` | FMP crypto universe를 `crypto_assets` 테이블에 적재 |
| `yarn db:seed:crypto-korean` | 암호화폐 한국어 이름 seed |
| `yarn db:backfill:calendar` | 경제 캘린더 backfill |
| `yarn db:seed:calendar-analysis` | 경제 캘린더 분석 seed |
| `yarn db:seed:calendar-analysis:batch` | 경제 캘린더 분석 batch seed |
| `yarn db:seed:indicator-translations:batch` | 경제 지표 번역 batch seed |
| `yarn test` | Vitest 전체 실행 |
| `yarn test:quiet` | Vitest dot reporter 실행 |
| `yarn test:related` | 변경 관련 Vitest 실행 |
| `yarn test-watch` | Vitest watch mode |
| `yarn test-coverage` | Vitest coverage 실행 |
| `yarn test-coverage-watch` | Vitest coverage watch mode |
| `yarn test-coverage-report` | 상세 coverage report |
| `yarn e2e` | E2E 하니스 스크립트 실행 |
| `yarn e2e:up` | E2E Docker compose 환경 시작 |
| `yarn e2e:down` | E2E Docker compose 환경 종료 및 volume 삭제 |
| `yarn e2e:db` | E2E DB global setup 실행 |
| `yarn test:e2e` | Playwright E2E 실행 |
| `yarn test:e2e:ui` | Playwright UI mode 실행 |
| `yarn format` | Prettier 전체 포맷 |
| `yarn format:staged` | staged 파일 Prettier 포맷 |
| `yarn typecheck` | TypeScript typecheck |
| `yarn validate:skills` | Skills Markdown 검증 |
| `yarn skills:digest-verify` | Skills digest 검증 |
| `yarn skills:digest-update` | Skills digest metadata 갱신 |
| `yarn format:check` | Prettier check |
| `yarn prepare` | Husky hook 설치 |
| `yarn release` | release-it 실행 |
| `yarn release:patch` | patch release |
| `yarn release:minor` | minor release |
| `yarn release:major` | major release |
| `yarn fetch-this-week-tasks` | 이번 주 작업 fetch 스크립트 실행 |
| `yarn update-popular-tickers` | 인기 ticker 목록 갱신 |
| `yarn update-popular-cryptos` | 인기 crypto 목록 갱신 |

패키지 설치는 항상 `yarn`을 사용합니다. `npm`과 `pnpm`은 사용하지 않습니다.

## Contributing

아직 외부 코드 기여 프로세스는 정식으로 열려 있지 않습니다. 버그 리포트나 제안은 [Issues](https://github.com/y0ngha/siglens/issues)로 남겨주세요.

Skills 기여도 아직 공개된 리뷰/머지 워크플로가 없습니다. `skills/` 디렉터리에 Markdown 파일 하나를 추가하면 분석 기법을 확장할 수 있도록 설계되어 있지만, frontmatter 표준과 검증 절차가 정리된 뒤 기여 가이드를 공개할 예정입니다.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE)

---

<div align="center">

**[Back to top](#siglens)** · **[English README](https://github.com/y0ngha/siglens/blob/master/README.en.md)**

</div>
