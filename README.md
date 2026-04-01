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

## Siglens - 미국 주식 AI 기술적 분석 플랫폼

[![Website](https://img.shields.io/badge/Website-siglens.io-blue?style=for-the-badge)](https://siglens.io)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?style=for-the-badge&logo=discord)](https://discord.gg/siglens)

[![Docs](https://img.shields.io/badge/Docs-Read%20Docs-green?style=for-the-badge)](https://github.com/y0ngha/siglens/tree/master/docs)
[![Issues](https://img.shields.io/badge/Issues-Report%20Bug-red?style=for-the-badge)](https://github.com/y0ngha/siglens/issues)

</div>

---

## 🎯 What is Siglens?

복잡한 기술적 분석을 **AI가 대신 처리**해주는 분석 전용 서비스입니다.

보조지표 추가, 거래량 파악, 캔들 패턴 해석 — 배우기 어렵고 시간이 많이 걸리는 작업들을 없앱니다.

```
기존 방식     보조지표 수동 추가 → 거래량 분석 → 패턴 해석
Siglens     → 자동 인디케이터 → AI 종합 분석 리포트
```

> 📌 **주문 기능 없음.** 분석 정보만 제공합니다. 투자 결정은 본인의 책임입니다.

---

## ✨ Features

- **📊 차트**: Lightweight Charts 기반 캔들, 거래량, 인디케이터 렌더링
- **📈 인디케이터**: RSI, MACD, 볼린저 밴드, DMI, VWAP, EMA 자동 계산
- **🔍 패턴 감지**: 헤드앤숄더, 쐐기, 이중천장/바닥 등 자동 감지
- **🤖 AI 분석**: 인디케이터 + 패턴 기반 종합 분석 리포트
- **⏱️ 멀티 타임프레임**: 1분봉 ~ 일봉 지원

---

## 🛠 Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2 (App Router + Turbopack) |
| UI | React 19.2, Tailwind CSS |
| Chart | Lightweight Charts |
| Data | Alpaca API (Free Tier, 15분 지연) |
| AI | Claude / GPT-4 |
| Testing | Jest |
| Language | TypeScript |
| Package Manager | yarn |

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js 25.2.1
yarn
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
- `ALPACA_API_KEY` / `ALPACA_API_SECRET` — [Alpaca Markets](https://alpaca.markets/data)에서 발급
- `ANTHROPIC_API_KEY` — [Anthropic](https://console.anthropic.com)에서 발급
- `AI_PROVIDER` — `claude` (기본값)

### Run Development Server

```bash
yarn dev
```

http://localhost:3000 접속

---

## 🏗️ Architecture

```
src/
├── app/              # Next.js App Router (RSC, Route Handler)
├── domain/           # 순수 TS 함수 (인디케이터, 패턴, 프롬프트)
├── infrastructure/   # 외부 의존성 (Alpaca, AI Provider)
└── components/       # React Client Components
```

**레이어 의존성 방향**

```
domain ← infrastructure ← app
                       ← components (domain만 허용)
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

**분석 기법을 코드가 아닌 자연어로 정의합니다.**

```
/skills/my-strategy.md 파일 하나 추가 = 새로운 분석 기법 즉시 적용
```

개발자가 아니어도, 트레이더, 투자자, 누구든 자신만의 분석 로직을 기여할 수 있도록 할 것 입니다.

아직 기여할 수 있는 프로세스가 정해지지 않아, 지금은 어렵습니다.

---

## 📚 Documentation

| 문서 | 내용 |
|------|------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 레이어 구조, 의존성 규칙, 데이터 흐름 |
| [DOMAIN.md](./docs/DOMAIN.md) | 인디케이터 계산 명세, 타입 정의 |
| [API.md](./docs/API.md) | Alpaca API, Claude API 명세 |
| [CONVENTIONS.md](./docs/CONVENTIONS.md) | 코딩 컨벤션, 네이밍, 자주 하는 실수 |
| [FF.md](./docs/FF.md) | 개발 원칙 (Frontend Fundamentals) |
| [GIT_CONVENTIONS.md](./docs/GIT_CONVENTIONS.md) | 깃 브랜치, 커밋 메시지, PR 규칙 |
| [DESIGN.md](./docs/DESIGN.md) | 컬러 시스템, Tailwind 설정, 차트 컬러 상수 |
| [SIGLENS_API.md](./docs/SIGLENS_API.md) | SIGLENS API 명세 |

---

## 🧪 Testing

```bash
# 전체 테스트
yarn test

# 커버리지 포함
yarn test --coverage

# 특정 파일
yarn test rsi.test.ts
```

**커버리지 목표**: `domain/`, `infrastructure/` 100%

---

## 📊 Data Source

[Alpaca Markets](https://alpaca.markets) Free Tier 기반

| 항목 | 값 |
|------|-----|
| Exchange | IEX |
| Delay | 15분 |
| Timeframe | 1분봉 ~ 일봉 |
| History | 7년+ |

---

## 🤝 Contributing

기여를 환영합니다! 다음 방법으로 참여할 수 있습니다:

아직 기여할 수 있는 프로세스가 정해지지 않아, 지금은 어렵습니다.

[//]: # (1. **버그 리포트**: [Issues]&#40;https://github.com/y0ngha/siglens/issues&#41;에서 보고)

[//]: # (2. **기능 제안**: [Discussions]&#40;https://github.com/y0ngha/siglens/discussions&#41;에서 논의)

[//]: # (3. **분석 기법 기여**: [CONTRIBUTING.md]&#40;./CONTRIBUTING.md&#41; 참고)

[//]: # (4. **코드 기여**: Fork → Branch → PR)

[//]: # ()
[//]: # (자세한 내용은 [🤝 CONTRIBUTING.md]&#40;./CONTRIBUTING.md&#41; 참고.)

---

## 💬 Community

질문, 피드백, 아이디어 공유:

- **[💬 Discord](https://discord.gg/siglens)** — 실시간 대화 
  - (현재는 MVP 운영중으로 초대받은 유저에게만 초대해드리고 있어요.)

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