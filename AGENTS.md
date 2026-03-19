# Siglens — AGENTS.md

미국 주식 AI 분석 플랫폼.
차트 렌더링, 인디케이터 계산, AI 기반 종합 분석을 제공한다.
주문 기능 없음. 분석 전용.

---

## 작업 시작 전 반드시 읽을 것

| 문서 | 내용 |
|------|------|
| `docs/ARCHITECTURE.md` | 레이어 구조, 의존성 방향 규칙, 폴더 구조 |
| `docs/DOMAIN.md` | 인디케이터 계산 명세, 비즈니스 규칙 |
| `docs/API.md` | Alpaca API 엔드포인트, 요청/응답 스키마 |
| `docs/CONVENTIONS.md` | 코딩 컨벤션, 네이밍, 자주 하는 실수 |
| `docs/FF.md` | FF 4원칙 상세 가이드 (Readability, Predictability, Cohesion, Coupling) |

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