# Siglens

미국 주식 AI 분석 플랫폼.
복잡한 기술적 분석을 AI가 대신 처리해주는 분석 전용 서비스.

---

## Vision

주가 분석을 할 때 보조지표를 직접 추가하고, 거래량을 파악하고, 캔들 패턴을 해석하는 일련의 작업들은 배우기 어렵고 시간이 많이 걸린다.

Siglens는 이 장벽을 없앤다.

**분석 기법을 코드가 아닌 자연어로 정의한다.**
`/skills/*.md` 파일 하나를 추가하는 것만으로 새로운 분석 기법이 즉시 적용된다.
개발자가 아니어도 된다. 트레이더가, 투자자가, 누구든 자신만의 분석 로직을 기여할 수 있다.

```
기존 방식
  새 분석 기법 추가 = 코드 작성 → 빌드 → 배포

Siglens 방식
  새 분석 기법 추가 = skills/my-strategy.md 파일 하나 추가
```

또한 분석 결과의 신뢰도를 지속적으로 높여나간다.
차트 데이터를 기반으로 분석 정확도를 측정하고,
잘못된 패턴이나 시대에 맞지 않는 기법은 AI 학습을 통해 점진적으로 개선해나간다.

---

## Development Philosophy

**Harness Engineering** — 코드의 99%를 AI가 작성한다.

사람의 역할은 단 하나다: **무엇을 만들지 결정하는 것.**

```
사람이 하는 것    무엇을 만들지 결정 (이슈 작성, 설계, 리뷰, 머지)
AI가 하는 것      어떻게 만들지 실행 (구현, 테스트, PR 오픈, 코드 리뷰)
```

Claude Code가 이슈를 받아 브랜치를 생성하고, 코드를 작성하고, 테스트를 통과시키고, PR을 오픈한다.
Claude Code Review가 PR을 자동으로 리뷰한다.
사람은 결과물을 검토하고 머지 여부만 결정한다.

이 구조 덕분에 혼자서도 빠르게 제품을 만들 수 있고,
AI 시대에 맞는 개발 방식을 직접 실험하고 검증하는 프로젝트이기도 하다.

---

## Features

- **차트**: Lightweight Charts 기반 캔들, 거래량, 인디케이터 렌더링
- **인디케이터**: RSI, MACD, 볼린저 밴드, DMI, VWAP, EMA 자동 계산
- **패턴 감지**: 헤드앤숄더, 쐐기, 이중천장/바닥 등 자동 감지
- **AI 분석**: 인디케이터 + 패턴 기반 종합 분석 리포트
- **멀티 타임프레임**: 1분봉 ~ 일봉 지원

> 주문 기능 없음. 분석 전용.

---

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16.2 (App Router + Turbopack) |
| UI | React 19.2, Tailwind CSS |
| 차트 | Lightweight Charts |
| 데이터 | Alpaca API (Free Tier, 15분 지연) |
| AI | Claude / GPT-4 |
| 테스트 | Jest |
| 언어 | TypeScript |
| 패키지 | yarn |
| Node.js | 25.2.1 |

---

## Architecture

```
src/
├── app/                  # Next.js App Router (RSC, Route Handler)
├── domain/               # 순수 TS 함수 (인디케이터, 패턴, 프롬프트)
├── infrastructure/       # 외부 의존성 (Alpaca, AI Provider)
└── components/           # React Client Components
```

**레이어 의존성 방향**

```
domain ← infrastructure ← app
                       ← components (domain만 허용)
```

자세한 내용은 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 참고.

---

## Getting Started

### 사전 요구사항

- Node.js 25.2.1
- yarn

### 설치

```bash
git clone https://github.com/your-username/siglens.git
cd siglens
yarn install
```

### 환경변수 설정

```bash
cp .env.example .env.local
```

```bash
# .env.local
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_API_SECRET=your_alpaca_api_secret
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Alpaca API 키 발급: https://alpaca.markets/data

### 개발 서버 실행

```bash
yarn dev
```

http://localhost:3000 접속.

---

## Testing

```bash
# 전체 테스트
yarn test

# 커버리지 포함
yarn test --coverage

# 특정 파일
yarn test rsi.test.ts
```

커버리지 목표: `domain/`, `infrastructure/` 100%

---

## Docs

| 문서                                              | 내용                           |
|-------------------------------------------------|------------------------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)       | 레이어 구조, 의존성 규칙, 데이터 흐름       |
| [DOMAIN.md](./docs/DOMAIN.md)                   | 인디케이터 계산 명세, 타입 정의           |
| [API.md](./docs/API.md)                         | Alpaca API, Claude API 명세    |
| [CONVENTIONS.md](./docs/CONVENTIONS.md)         | 코딩 컨벤션, 네이밍, 자주 하는 실수        |
| [FF.md](./docs/FF.md)                           | 개발 원칙 (Frontend Fundementals) |
| [GIT_CONVENTIONS.md](./docs/GIT_CONVENTIONS.md) | 깃 브랜치, 커밋 메시지, PR 규칙         |
| [DESIGN.md](./docs/DESIGN.md)                   | 컬러 시스템, Tailwind 설정, 차트 컬러 상수 |
| [SIGLENS_API.md](./docs/SIGLENS_API.md)         | SIGLENS API 명세               |

---

## Data Source

[Alpaca Markets](https://alpaca.markets) Free Tier 기반.

```
거래소   IEX
지연     15분
범위     1분봉 ~ 일봉
기간     7년+
```

---

## License

MIT