# Siglens

<div align="center">

![Status](https://img.shields.io/badge/status-BETA-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash-00E9A3?style=flat&logo=upstash&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)

![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D25.2.1-green)

## Siglens — 미국 주식 AI 기술적 분석 플랫폼

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord)](https://discord.gg/CVCv9ETrZU)

[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

## 🎯 What is Siglens?

복잡한 기술적 분석을 **AI가 대신 처리**해주는 분석 전용 서비스입니다.

이동평균, 골든/데드 크로스, MACD, RSI, 볼린저 밴드, DMI — 여러 보조지표를 동시에 읽고,
타임프레임마다 설정을 바꾸고, 차트 패턴(헤드앤숄더, 쐐기, 이중천장 등)까지 식별해야 하는
기술적 분석은 진입 장벽이 높고 시간도 많이 듭니다.

```
기존 방식    보조지표 수동 추가 → 거래량 분석 → 패턴 해석 → 종합 판단
Siglens     → 티커만 입력 → 차트 + 인디케이터 자동 렌더 → AI 종합 분석 리포트
```

> 📌 **주문 기능 없음.** 분석 정보만 제공합니다. 투자 결정은 본인의 책임입니다.

---

## ✨ Features

- **📊 차트** — Lightweight Charts v5 기반 캔들/거래량/인디케이터 렌더링, 5분봉~일봉 멀티 타임프레임
- **📈 인디케이터 25종** — RSI, MACD, 볼린저 밴드, ADX, DMI, Stochastic, StochRSI, CCI, VWAP, MA, EMA, Volume Profile, Ichimoku Cloud, ATR, Donchian/Keltner Channel, SuperTrend, OBV, CMF, MFI, Parabolic SAR, Williams %R, Squeeze Momentum, Smart Money Concepts 자동 계산
- **🕯️ 캔들 패턴** — 단일 캔들 15종 + 멀티 캔들 30종 자동 감지
- **🔍 차트 패턴** — 헤드앤숄더, 쐐기, 이중천장/바닥, 삼각수렴, 플래그, 컵앤핸들 등 Skills 기반 감지
- **🎯 옵션 분석** — Max Pain, Put/Call Ratio, ATM IV, Implied Move, Strike별 Open Interest 분포를 AI가 한국어로 해석 (`/[symbol]/options`)
- **🤖 AI 종합 분석** — 트렌드 방향, 리스크 레벨, 지지/저항, 가격 목표, 진입 추천 리포트
- **🧠 AI 모델 선택** — Claude(Haiku/Sonnet/Opus), Gemini(2.5 Flash-Lite~3.1 Pro Preview), ChatGPT(GPT-5) 중 페이지별로 직접 선택. Free 모델은 누구나 / Pro 모델은 회원 게이트
- **🔑 BYOK (Bring Your Own Key)** — 본인 API Key 등록 시 한도 우회 (Anthropic / Google / OpenAI 지원, 암호화 저장)
- **👤 회원가입 (옵션)** — 비회원도 모든 기본 기능 사용. 가입 시 free/member/pro tier에 따라 Pro 모델·BYOK·한도 상향
- **💬 AI 챗봇** — 분석 결과 기반 자연어 후속 질문 (Gemini 2.5 Flash, IP당 5회/일)
- **🌐 시장 현황 대시보드** — 11개 섹터 200+ 종목 신호 스캐너 (골든크로스, RSI 다이버전스, 볼린저 스퀴즈)
- **🧪 AI 백테스팅** — 2년간 100건 분석 결과의 실제 수익률 검증 (/backtesting)
- **♻️ 온디맨드 재분석** — 사용자 요청 시 즉시 재분석

---

## 🌐 시장 현황 대시보드

종목 하나하나를 찾아다니지 않아도, **지금 어떤 섹터에서 신호가 나오고 있는지** 한눈에 파악할 수 있습니다.
[오늘 주목할 주식 보기 >](https://siglens.io/market), [오늘 전체 시장 현황 보기 >](https://siglens.io/market)

```
/market 접속 → 11개 섹터 탭 → 각 종목의 현재 신호 확인 → 원클릭으로 AI 분석 페이지 이동
```

**스캔 대상 신호:**
- **골든크로스** — 단기 이동평균선이 장기선을 상향 돌파한 종목
- **RSI 다이버전스** — 가격과 RSI 방향이 엇갈리는 잠재적 반전 신호
- **볼린저 스퀴즈** — 변동성 수축 이후 급등/급락 가능성이 높은 구간

**스캔 범위:** 메가캡, AI/반도체, 소프트웨어, 핀테크/크립토, EV, 레버리지 ETF, 금융, 소비재, 에너지, 헬스케어, 중국 ADR 등 11개 섹터 200+ 종목

---

## 💬 AI 챗봇 & 모델 선택

분석 리포트를 받은 뒤 궁금한 점을 **자연어로 바로 물어볼 수 있습니다.** 분석 페이지마다 사용할 AI 모델을 직접 골라 쓸 수도 있습니다.

```
AI 분석 리포트 수신 → 챗봇 패널에서 후속 질문 → 분석 컨텍스트를 그대로 이어서 답변
```

**선택 가능한 AI 모델 (3 프로바이더):**
- **Claude (Anthropic)** — Haiku 4.5 / Sonnet 4.6 / Opus 4.7
- **Gemini (Google)** — 2.5 Flash-Lite / 2.5 Flash / 2.5 Pro / 3 Flash Preview / 3.1 Pro Preview
- **ChatGPT (OpenAI)** — GPT-5 Mini / 5.4 / 5.5

> Free 모델은 누구나 사용 가능, Pro 모델은 회원 게이트(`useModelGate`)로 잠금 해제. 본인 API Key를 등록하면(BYOK) 사용량 한도 우회.

**챗봇:**
- **엔진**: Gemini 2.5 Flash — 분석 원문 전체가 컨텍스트로 주입됨
- **대화 기록**: localStorage에 세션 단위로 저장
- **사용 제한**: IP당 5회/일 (무료 서비스 유지를 위한 제한, BYOK 등록 시 무제한)

> 예시 질문: "지금 RSI가 과매도라고 했는데, 어느 레벨에서 반등을 기대할 수 있어?"

---

## 👤 회원가입 (옵션)

회원가입은 **선택입니다.** 비회원도 모든 기본 분석 기능을 그대로 쓸 수 있고, 회원이 되면 tier에 따라 Pro AI 모델 / BYOK / 분석 한도 상향 등이 열립니다.

| Tier | AI 모델 | BYOK | 한도 |
|------|---------|------|------|
| Free (비회원/기본 회원) | Free 모델 전체 | ❌ | IP 단위 |
| Member | Free + 일부 Pro | ✅ | 사용자 단위 |
| Pro | 모든 Pro 모델 | ✅ | 사용자 단위 (상향) |

- **인증**: 이메일/비밀번호 (bcrypt) + Google OAuth + Kakao OAuth (구성)
- **계정 페이지**: `/account` (정보 수정), `/account/delete` (즉시 파기)
- **비밀번호 재설정**: `/forgot-password` → 이메일 링크 → `/reset-password`
- **이메일 인증**: 가입 후 메일 발송 (Resend)

---

## 🎯 옵션 분석 (`/[symbol]/options`)

미국 옵션 시장은 한국 투자자가 접근하기 어렵습니다. Max Pain이 어디인지, Put/Call Ratio가 어느 쪽으로 기울었는지, 만기까지 시장이 얼마나 변동을 예상하는지(ATM IV / Implied Move) — 이런 신호를 **AI가 만기별로 한국어로 해석**해줍니다.

```
/AAPL/options 접속 → 만기 선택 → 4개 메트릭 카드 + Strike별 OI 분포 차트 + 옵션 체인 테이블 + AI 한국어 해석
```

**제공 항목:**
- **Max Pain** — 만기일에 옵션 매도자가 손실을 최소화하는 가격
- **Put/Call Ratio** — Call 대비 Put 거래 비중
- **ATM IV** — 등가격(At-The-Money) 옵션의 내재 변동성
- **Implied Move** — 시장이 다음 만기까지 예상하는 변동 폭
- **Open Interest 분포** — Strike별 미결제 약정 (Call/Put bar, Max Pain 점선, 현재가 실선)
- **옵션 체인 테이블** — Call/Put × Strike별 IV, 거래량, OI

**차트 페이지 보조 카드:** 옵션 시장이 있는 종목은 차트 페이지 하단에도 3개 시그널 카드(ATM IV / Put/Call / Max Pain)가 자동 표시됩니다.

**데이터 소스:** yahoo-finance2 (스냅샷 기반, 시장 시간대에 따라 캐시 프로파일 자동 전환). 옵션 시장이 없는 종목은 `hasOptionsMarket` 가드로 빈 상태 안내 + `robots: noindex`.

> ⚠️ Phase 1 한계: 스냅샷 only (Historical OI/IV 누적 파이프라인 없음, IV Rank는 ATM IV로 표시). Tradier fallback 어댑터는 후속 PR로 추가 예정.

---

## 🧪 AI 백테스팅 (`/backtesting`)

AI 분석의 실제 정확도를 검증하기 위해 **2년간(2024.04 ~ 2026.04) 100건의 분석 결과**를 백테스팅했습니다.

- **승률 70%** — 신호 발생 후 실제 가격 움직임 기준
- **AI 방향 예측 적중률 61.5%** — AI 리포트의 상승/하락/중립 예측 vs 실제 결과
- 10개 대표 종목, 100건 케이스, 실제 AI 분석 원문 포함

결과는 [백테스팅 결과](https://siglens.io/backtesting) 페이지에서 확인할 수 있으며, 원본 데이터는 `src/app/backtesting/data.json`에 저장되어 있습니다.

---

## 📊 Data Source

| 데이터 | 출처 | 비고 |
|------|------|------|
| 시세 (OHLCV) | [Financial Modeling Prep](https://site.financialmodelingprep.com) | 5분봉~일봉 멀티 타임프레임, 최대 15분 지연 |
| 펀더멘털 (재무·밸류에이션·애널리스트) | FMP `/stable` API | PER, ROE, EPS, 컨센서스, 목표가 |
| 뉴스·어닝 | FMP `/stable` API | 한국어 sentiment는 Gemini Flash-lite로 자체 분석 |
| 옵션 시장 (체인·OI·IV·Greeks) | yahoo-finance2 | `OptionsDataProvider` 어댑터 (Tradier fallback 가능) |

---

## 💬 Community

- **[💬 Discord](https://discord.gg/siglens)** — 실시간 대화
  - 현재는 MVP 운영 중으로 초대받은 유저에게만 초대해드리고 있어요.

---

## ⚠️ Disclaimer

**Siglens는 분석 정보만 제공하며 투자 조언이 아닙니다.**

- 제시된 분석 결과를 기반으로 한 모든 투자 결정은 **본인의 책임**입니다.
- 운영자는 분석 정보로 인한 금전적 손실에 대해 법적 책임을 지지 않습니다.
- 투자 결정 전에 충분한 조사와 자체 판단을 권장합니다.

---

---

## 🛠 Tech Stack

| 영역 | 기술                                                              |
|------|-----------------------------------------------------------------|
| Framework | Next.js 16.2 (App Router + Turbopack + React Compiler)          |
| UI | React 19.2, Tailwind CSS 4                                      |
| Chart | Lightweight Charts v5 (가격) + 자체 SVG (옵션 OI)                |
| Data | FMP API (시세·펀더·뉴스), yahoo-finance2 (옵션 체인)            |
| Cache | Upstash Redis                                                   |
| AI | Claude (Anthropic), Gemini 2.5/3.x (Google), ChatGPT GPT-5 (OpenAI) — 페이지별 모델 선택 / Gemini 2.5 Flash — 챗봇·옵션 해석 |
| Auth | bcryptjs (이메일/비밀번호) + Google/Kakao OAuth + 암호화 세션 쿠키 |
| State | TanStack Query v5                                               |
| Testing | Jest (domain / infrastructure)                                  |
| Language | TypeScript 5                                                    |
| Package Manager | yarn 4.12.0                                                     |
| Runtime | Node.js 25.2.1                                                  |
| Deploy | Vercel (Edge Functions), Cloud Run (Worker)                     |

---

## 🚀 Quick Start

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

### Setup Environment

```bash
cp .env.example .env.local
```

필수 환경변수:

| 변수 | 발급처 | 용도 |
|------|--------|------|
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/developer) | 시세 · 종목 데이터 |
| `GEMINI_CHAT_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini 모델 — AI 분석 리포트 · 챗봇 · 옵션 해석 (유료 키) |
| `GEMINI_CHAT_FREE_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | 챗봇 quota 소진 시 fallback (무료 키) |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/) | Claude 모델 (Haiku 4.5 / Sonnet 4.6 / Opus 4.7) |
| `OPENAI_CHAT_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | ChatGPT 모델 (GPT-5 Mini / 5.4 / 5.5) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://upstash.com) | 분석 캐시 |
| `DATABASE_URL` | [Neon](https://neon.tech) | PostgreSQL (인증 · 사용자 데이터) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` / `LLM_API_KEY_ENCRYPTION_KEY` | `openssl rand -hex 32` 로 생성 | DB 저장 시 토큰 · API 키 암호화 |

선택 환경변수 (기능별 필요):

| 변수 | 용도 |
|------|------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 로그인 |
| `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | Kakao OAuth 로그인 |
| `RESEND_API_KEY` / `EMAIL_FROM` | 이메일 발송 |
| `NEXT_PUBLIC_ADSENSE_*` | Google AdSense |
| `SIGLENS_GITHUB_TOKEN` | `@y0ngha/siglens-core` 설치 (GitHub Packages) |

### Run Development Server

```bash
yarn dev
```

http://localhost:4200 접속

---

## 🏗️ Architecture

```
siglens/
├── src/
│   ├── app/              # Next.js App Router (RSC, Route Handler)
│   │   ├── market/       # 시장 현황 대시보드 (섹터별 신호 스캐너)
│   │   ├── backtesting/  # AI 백테스팅 결과 페이지 + data.json
│   │   └── [symbol]/     # 종목별 AI 분석 페이지 (기술/펀더/뉴스/공포탐욕/옵션/종합)
│   ├── domain/           # 순수 TS — 인디케이터, 패턴, 프롬프트 빌더, options 헬퍼
│   ├── infrastructure/   # 외부 의존성 — FMP, AI Provider, Skills Loader, YahooOptionsAdapter
│   ├── components/       # React Client Components (options/ 포함)
│   └── lib/              # UI 유틸, React Query 키 팩토리, optionsFormatters
├── skills/               # 분석 기법 정의 (.md, 코드 아님)
│   ├── patterns/         # 차트 패턴 (헤드앤숄더, 쐐기, 이중천장/바닥 등)
│   ├── indicators/       # 보조지표 시그널 해석
│   ├── strategies/       # 엘리어트 파동, 와이코프, 대순환 등 전략
│   ├── support-resistance/ # 피보나치, 피봇포인트
│   └── candlesticks/     # 캔들 패턴 교육
├── docs/                 # 아키텍처/도메인/컨벤션 문서
└── refs/                 # 보조지표·투자 이론 레퍼런스
```

**레이어 의존성 방향**

```
domain          ← 외부 import 금지. 순수 함수만.
infrastructure  ← domain만 import 가능. 파일 I/O와 API 호출 담당.
lib             ← UI 유틸 래퍼. 순수 함수.
app             ← infrastructure, domain, lib import 가능.
components      ← domain, lib import 가능. infrastructure 직접 import 금지.
```

자세한 내용은 [📖 ARCHITECTURE.md](./docs/ARCHITECTURE.md) 참고.

---

## 💭 Development Philosophy

### Harness Engineering

코드의 **99%를 AI가 작성**합니다.

```
사람이 하는 것    무엇을 만들지 결정 (이슈 작성, 설계, 리뷰, 머지)
AI가 하는 것      어떻게 만들지 실행 (구현, 테스트, PR 오픈, 코드 리뷰)
```

Claude Code가 이슈를 받아 브랜치 생성 → 코드 작성 → 테스트 → PR 오픈까지 자동으로 진행합니다.
사람은 결과를 검토하고 머지 여부만 결정합니다.

이 구조 덕분에 혼자서도 빠르게 제품을 만들 수 있으며, **AI 시대의 개발 방식을 직접 실험하고 검증**하는 프로젝트이기도 합니다.

### Skills: 코드 없이 분석 기법 추가하기

분석 기법을 코드가 아닌 **자연어(.md)로 정의**합니다.

```
/skills/<category>/my-strategy.md 파일 하나 추가 → 새로운 분석 기법 즉시 적용
```

`infrastructure/skills/loader.ts`가 `skills/` 디렉토리를 재귀적으로 스캔해서 frontmatter와
본문을 파싱하고, `domain/analysis/prompt.ts`가 이를 AI 프롬프트에 주입합니다.
도메인 코드를 건드리지 않고 분석 기법을 추가/수정할 수 있다는 의미입니다.

현재 등록된 카테고리 (7개 카테고리 / 총 67개 Skills):

- `skills/patterns/` — 차트 패턴 (헤드앤숄더, 쐐기, 이중천장/바닥, 삼각수렴, 플래그 등)
- `skills/indicators/` — 보조지표 시그널 해석 (RSI, MACD, 볼린저 밴드, 일목균형표 등)
- `skills/strategies/` — 엘리어트 파동, 와이코프, 대순환 분석, 다이버전스, 브레이크아웃 등
- `skills/support-resistance/` — 피보나치 되돌림/확장, 피봇포인트
- `skills/candlesticks/` — 도지, 장악형, 망치형, 마루보주, 하라미, 이브닝/모닝스타 등
- `skills/fundamental/` — 가치 투자 / 성장 투자 / 퀄리티 투자 등
- `skills/news/` — 이벤트 드리븐 / 매크로 영향 / 어닝 리액션 등

---

## 📚 Documentation

| 문서 | 내용 |
|------|------|
| [SERVICE.md](./docs/SERVICE.md) | 서비스 개요, 대상 사용자, 기술 스택, Skills 시스템 |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 레이어 구조, 의존성 규칙, 데이터 흐름 |
| [DOMAIN.md](./docs/DOMAIN.md) | 인디케이터 계산 명세, 캔들 패턴, Skills 시스템 |
| [API.md](./docs/API.md) | Alpaca, FMP API, Claude, Gemini API 명세 |
| [CONVENTIONS.md](./docs/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 패러다임 |
| [FF.md](./docs/FF.md) | FF 4원칙 (Readability, Predictability, Cohesion, Coupling) |
| [DESIGN.md](./docs/DESIGN.md) | 컬러 시스템, Tailwind 설정, 차트 컬러 상수 |
| [GIT_CONVENTIONS.md](./docs/GIT_CONVENTIONS.md) | 브랜치, 커밋 메시지, PR 규칙 |
| [MISTAKES.md](./docs/MISTAKES.md) | 자주 하는 실수 모음 |

---

## 🧪 Testing

```bash
yarn test                    # 전체 테스트
yarn test-watch              # watch
yarn test-coverage           # 커버리지 포함
yarn test-coverage-report    # 커버리지 리포트
```

**커버리지 목표**: `domain/`, `infrastructure/` 100% (UI는 테스트 대상 아님)

---

## 🧰 Commands

```bash
yarn dev               # 개발 서버 (포트 4200)
yarn build             # 프로덕션 빌드
yarn lint              # ESLint
yarn lint:fix
yarn lint:style        # Stylelint
yarn lint:style-fix
yarn format            # Prettier
```

패키지 설치는 항상 `yarn`. `npm`/`pnpm`은 사용하지 않습니다.

---

## 🤝 Contributing

### 코드 기여

아직 외부 코드 기여 프로세스가 정해지지 않아, 지금은 받을 수 없습니다.
버그 리포트나 제안은 [Issues](https://github.com/y0ngha/siglens/issues)로 남겨주세요.

### Skills 기여 (분석 기법 추가)

`skills/` 디렉토리에 `.md` 파일 하나만 추가하면 새로운 분석 기법을 적용할 수 있도록 설계되어 있습니다.
하지만 아직 다음이 정해지지 않았습니다:

- Skill `.md` 파일의 frontmatter 표준 스펙 공개
- 신뢰도(`confidence_weight`) 검증 절차
- 리뷰/머지 워크플로
- 기여자 가이드

따라서 **현재는 외부에서 Skills를 기여하기 어렵습니다.** 틀이 잡히는 대로 이 섹션을 업데이트할 예정입니다.
관심 있으신 분은 Discord에서 미리 의견을 남겨주세요.

---

## 📄 License

[MIT](./LICENSE)

---

<div align="center">

**[⬆ 맨 위로](#siglens)**

</div>
