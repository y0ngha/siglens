# Siglens — AGENTS.md

미국 주식 AI 분석 플랫폼.
차트 렌더링, 인디케이터 계산, AI 기반 종합 분석을 제공한다.
주문 기능 없음. 분석 전용.

---

## 서비스 개요

### 왜 만드는가

주식 기술적 분석은 배우기 어렵고 피로한 작업이다.
이동평균선, 골든크로스/데드크로스, MACD, RSI, 볼린저 밴드, DMI 등
여러 인디케이터를 동시에 봐야 하고, 분석 주기(일봉/분봉)마다
각 인디케이터의 설정값도 달라진다.
여기에 차트 패턴(헤드앤숄더, 쐐기, 이중천장 등)까지 파악해야 해서
시간이 많이 걸리고 진입 장벽이 높다.

Siglens는 이 복잡한 과정을 AI가 대신 처리해준다.

### 핵심 가치

```
복잡한 기술적 분석을 AI가 자동으로 처리
→ 사용자는 종목만 입력하면 된다
```

### 타겟 사용자

```
기술적 분석에 관심은 있지만
인디케이터를 일일이 설정하고 해석하기 피로한 투자자

주식을 시작했지만 차트 분석이 어려운 입문자

여러 인디케이터를 한 번에 종합 해석하고 싶은 투자자
```

### 핵심 UX

```
1. 종목 입력 (예: AAPL)
2. 차트 + 인디케이터 자동 렌더링
3. AI 종합 분석 리포트 자동 생성
   - 인디케이터 해석 (RSI 과매수/과매도, MACD 크로스 등)
   - 패턴 감지 (헤드앤숄더, 쐐기 등)
   - 지지/저항 레벨
   - 종합 시장 방향성 (bullish/bearish/neutral)
4. 타임프레임 전환 (1분봉 ~ 일봉)
5. 필요시 AI 재분석 요청
```

### 제공하지 않는 것

```
❌ 주문/매매 기능
❌ 실시간 데이터 (15분 지연)
❌ 투자 권유 또는 매수/매도 추천
```

---

## 작업 시작 전 반드시 읽을 것

| 문서 | 내용 |
|------|------|
| `docs/ARCHITECTURE.md` | 레이어 구조, 의존성 방향 규칙, 폴더 구조 |
| `docs/DOMAIN.md` | 인디케이터 계산 명세, 비즈니스 규칙 |
| `docs/API.md` | Alpaca API 엔드포인트, 요청/응답 스키마 |
| `docs/CONVENTIONS.md` | 코딩 컨벤션, 네이밍, 자주 하는 실수 |
| `docs/FF.md` | FF 4원칙 상세 가이드 (Readability, Predictability, Cohesion, Coupling) |
| `docs/DESIGN.md` | 컬러 시스템, Tailwind 설정, 차트 컬러 상수 |
| `docs/GIT_CONVENTIONS.md` | 브랜치 네이밍, 커밋 메시지, PR 규칙 |
| `docs/FLOW.md` | 이슈→PR, PR 리뷰 수정, 공통 처리 절차 |

**태스크를 받으면 반드시 위 문서를 먼저 읽고 시작한다.**
문서에 명시된 규칙은 어떤 경우에도 위반하지 않는다.

---

## 레이어 의존성 규칙 (절대 위반 금지)

```
domain         ← 외부 import 없음. 순수 TypeScript 함수만.
infrastructure ← domain만 import 가능
app(RSC/Route) ← infrastructure, domain import 가능
components     ← domain만 import 가능. infrastructure 직접 import 금지.
```

위반 시 ESLint 에러 발생. PR 머지 불가.

---

## 기술 스택 요약

```
Next.js     16.2  (App Router + Turbopack)
React       19.2
TypeScript  최신
Node.js     25.2.1
yarn        4.12.0
```

```
차트        lightweight-charts
스타일      Tailwind CSS
린트        ESLint + Stylelint + Prettier
테스트      Jest (domain, infrastructure만. UI 테스트 없음)
```

---

## 명령어

패키지 설치 시 반드시 `yarn`을 사용한다. `npm`, `pnpm` 사용 금지.

```bash
# 개발 서버 (포트 4200)
yarn dev

# 빌드
yarn build

# 린트
yarn lint
yarn lint:fix
yarn lint:style
yarn lint:style-fix

# 테스트
yarn test
yarn test-watch
yarn test-coverage
yarn test-coverage-watch
yarn test-coverage-report

# 포맷
yarn format
```

---

## 코드 품질 원칙

- **FF 원칙**: Readability, Predictability, Cohesion, Coupling
- **AHA**: 세 번 반복될 때 추상화. 섣부른 추상화 금지.
- 커버리지 100% 목표 (domain, infrastructure)

---

## 태스크 수행 규칙

1. 태스크를 받으면 관련 `docs/` 문서를 먼저 읽는다.
2. 인터페이스(`types.ts`)를 먼저 정의하고 구현체를 작성한다.
3. 구현 후 반드시 테스트 파일을 함께 작성한다.
4. 레이어 의존성 방향을 위반하지 않는다.
5. `domain/`에는 외부 라이브러리 import를 넣지 않는다.