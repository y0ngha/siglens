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
- **🤖 AI 종합 분석** — 트렌드 방향, 리스크 레벨, 지지/저항, 가격 목표, 진입 추천 리포트
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

## 💬 AI 챗봇

분석 리포트를 받은 뒤 궁금한 점을 **자연어로 바로 물어볼 수 있습니다.**

```
AI 분석 리포트 수신 → 챗봇 패널에서 후속 질문 → 분석 컨텍스트를 그대로 이어서 답변
```

- **엔진**: Gemini 2.5 Flash — 분석 원문 전체가 컨텍스트로 주입됨
- **대화 기록**: localStorage에 세션 단위로 저장
- **사용 제한**: IP당 5회/일 (무료 서비스 유지를 위한 제한)

> 예시 질문: "지금 RSI가 과매도라고 했는데, 어느 레벨에서 반등을 기대할 수 있어?"

---

## 🧪 AI 백테스팅 (`/backtesting`)

AI 분석의 실제 정확도를 검증하기 위해 **2년간(2024.04 ~ 2026.04) 100건의 분석 결과**를 백테스팅했습니다.

- **승률 70%** — 신호 발생 후 실제 가격 움직임 기준
- **AI 방향 예측 적중률 61.5%** — AI 리포트의 상승/하락/중립 예측 vs 실제 결과
- 10개 대표 종목, 100건 케이스, 실제 AI 분석 원문 포함

결과는 [백테스팅 결과](https://siglens.io/backtesting) 페이지에서 확인할 수 있으며, 원본 데이터는 `src/app/backtesting/data.json`에 저장되어 있습니다.

---

## 📊 Data Source

[Financial Modeling Prep](https://site.financialmodelingprep.com)

| 항목 | 값                               |
|------|---------------------------------|
| Exchange | 미국 전체 시장                        |
| Timeframe | 5분봉, 15분봉, 30분봉, 4시간봉, 1시간봉, 일봉 |
| Delay | 최대 15분 지연                       |
| History | 다년간                             |

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
| Chart | Lightweight Charts v5                                           |
| Data | FMP API                                                         |
| Cache | Upstash Redis                                                   |
| AI | Claude (Anthropic), Gemini 2.5 — 분석 리포트 / Gemini 2.5 Flash — 챗봇 |
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
- `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` — [Alpaca Markets](https://alpaca.markets)에서 발급 (시세 데이터)
- `FMP_API_KEY` — [Financial Modeling Prep](https://site.financialmodelingprep.com/developer)에서 발급 (종목 정보)
- `ANTHROPIC_API_KEY` — [Anthropic Console](https://console.anthropic.com)에서 발급 (AI 분석 리포트)
- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey)에서 발급 (AI 챗봇)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — [Upstash](https://upstash.com)에서 발급 (캐시)

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
│   │   └── [symbol]/     # 종목별 AI 분석 페이지
│   ├── domain/           # 순수 TS — 인디케이터, 패턴, 프롬프트 빌더
│   ├── infrastructure/   # 외부 의존성 — Alpaca, FMP, AI Provider, Skills Loader
│   ├── components/       # React Client Components
│   └── lib/              # UI 유틸, React Query 키 팩토리
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

현재 등록된 카테고리 (총 61개 Skills):

- `skills/patterns/` — 차트 패턴 (헤드앤숄더, 쐐기, 이중천장/바닥, 삼각수렴, 플래그 등)
- `skills/indicators/` — 보조지표 시그널 해석 (RSI, MACD, 볼린저 밴드, 일목균형표 등)
- `skills/strategies/` — 엘리어트 파동, 와이코프, 대순환 분석, 다이버전스, 브레이크아웃 등
- `skills/support-resistance/` — 피보나치 되돌림/확장, 피봇포인트
- `skills/candlesticks/` — 도지, 장악형, 망치형, 마루보주, 하라미, 이브닝/모닝스타 등

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
