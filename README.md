# Siglens

<div align="center">

![Status](https://img.shields.io/badge/status-MVP-yellow)
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
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord)](https://discord.gg/siglens)

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

- **📊 차트** — Lightweight Charts 기반 캔들/거래량/인디케이터 렌더링
- **📈 인디케이터** — RSI, MACD, 볼린저 밴드, DMI, VWAP, EMA 자동 계산
- **🕯️ 캔들 패턴** — 단일 캔들 15종 + 멀티 캔들 30종 자동 감지
- **🔍 차트 패턴** — 헤드앤숄더, 쐐기, 이중천장/바닥 등 Skills 기반 감지
- **🤖 AI 종합 분석** — 인디케이터 해석 + 패턴 + 지지/저항 + 방향성 리포트
- **♻️ 온디맨드 재분석** — 사용자 요청 시 즉시 재분석

---

## 🛠 Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2 (App Router + Turbopack) |
| UI | React 19.2, Tailwind CSS |
| Chart | Lightweight Charts |
| Data | FMP (Financial Modeling Prep) API |
| AI | Claude (Anthropic) / Gemini (Google) |
| Testing | Jest (domain / infrastructure) |
| Language | TypeScript |
| Package Manager | yarn 4.12.0 |
| Runtime | Node.js 25.2.1 |

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
- `FMP_API_KEY` — [Financial Modeling Prep](https://site.financialmodelingprep.com/developer)에서 발급
- `ANTHROPIC_API_KEY` — [Anthropic Console](https://console.anthropic.com)에서 발급
- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey)에서 발급
- `AI_PROVIDER` — `claude` 또는 `gemini`

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
│   ├── domain/           # 순수 TS — 인디케이터, 패턴, 프롬프트 빌더
│   ├── infrastructure/   # 외부 의존성 — Alpaca, FMP, AI Provider, Skills Loader
│   ├── components/       # React Client Components
│   └── lib/              # UI 유틸, React Query 키 팩토리
├── skills/               # 분석 기법 정의 (.md, 코드 아님)
│   ├── patterns/
│   ├── indicators/
│   └── strategies/
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

현재 등록된 카테고리:

- `skills/patterns/` — 차트 패턴 (헤드앤숄더, 쐐기, 이중천장/바닥 등)
- `skills/indicators/` — 보조지표 시그널 (예정)
- `skills/strategies/` — 대순환 분석 등 전략 (예정)

---

## 📚 Documentation

| 문서 | 내용                                                       |
|------|----------------------------------------------------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 레이어 구조, 의존성 규칙, 데이터 흐름                                   |
| [DOMAIN.md](./docs/DOMAIN.md) | 인디케이터 계산 명세, 캔들 패턴, Skills 시스템                           |
| [API.md](./docs/API.md) | Alpaca, FMP API, Claude, Gemini API 명세                   |
| [CONVENTIONS.md](./docs/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 패러다임                                        |
| [FF.md](./docs/FF.md) | FF 4원칙 (Readability, Predictability, Cohesion, Coupling) |
| [DESIGN.md](./docs/DESIGN.md) | 컬러 시스템, Tailwind 설정, 차트 컬러 상수                            |
| [GIT_CONVENTIONS.md](./docs/GIT_CONVENTIONS.md) | 브랜치, 커밋 메시지, PR 규칙                                       |
| [MISTAKES.md](./docs/MISTAKES.md) | 자주 하는 실수 모음                                              |

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

## 📊 Data Source

[Financial Modeling Prep (FMP)](https://site.financialmodelingprep.com) 기반

| 항목 | 값 |
|------|-----|
| Exchange | 미국 전체 시장 |
| Timeframe | 일봉 (현재 비용 이슈로 일봉만 지원) |
| History | 다년간 |

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

## 📄 License

[MIT](./LICENSE)

---

<div align="center">

**[⬆ 맨 위로](#siglens)**

</div>
