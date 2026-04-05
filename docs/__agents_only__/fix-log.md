# Fix Log

## [예시 항목 | 브랜치명 | 날짜]
- Violation: 예시
- Rule: 예시
- Context: 예시

## [Issue #176 | fix/176/alpaca-getBars-최신-데이터-반환 | 2026-04-05]
- Violation: 환경변수명 불일치 — `ALPACA_SECRET_KEY` 사용 (올바른 이름: `ALPACA_API_SECRET`)
- Rule: Infrastructure CLAUDE.md — Auth env vars are `ALPACA_API_KEY`, `ALPACA_API_SECRET`
- Context: alpaca.ts 생성 시 docs/API.md 및 infrastructure CLAUDE.md에 정의된 환경변수명을 확인하지 않고 임의로 `ALPACA_SECRET_KEY`를 사용해 런타임에서 항상 undefined가 반환됐다.

- Violation: `AlpacaProvider` 클래스 사용 — 일반 market data provider에 class 사용
- Rule: Infrastructure CLAUDE.md — Always use `export function`. Classes allowed only for special cases (e.g., Skills Loader).
- Context: infrastructure 레이어에서 `export function` 규칙을 따르지 않고 `export class AlpacaProvider`를 작성했다. Skills Loader처럼 특별한 이유가 없는 한 class는 금지된다.

## [Issue #176 Round 2 | fix/176/alpaca-getBars-최신-데이터-반환 | 2026-04-05]
- Violation: 테스트 파일 위치가 소스 디렉토리 구조를 미러링하지 않음 — `src/__tests__/infrastructure/alpaca.test.ts` 위치 사용 (올바른 위치: `src/__tests__/infrastructure/market/alpaca.test.ts`)
- Rule: CONVENTIONS.md Test Rules — test file must mirror source directory structure. infrastructure/market/alpaca.test.ts, not infrastructure/alpaca.test.ts.
- Context: `src/infrastructure/market/alpaca.ts` 소스 파일을 위한 테스트를 작성할 때 `market/` 서브디렉토리를 생략하고 `infrastructure/` 바로 아래에 파일을 위치시켰다.

## [PR #186 | fix/174/symbol-page-initial-loading-performance | 2026-04-05]
- Violation: 하드코딩된 `initialAnalysisFailed={true}`에 의도 주석 누락
- Rule: FF.md Readability 1-A — 역할이 다른 코드는 분리, 코드의 의도가 명확히 드러나야 함
- Context: SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트에 위임하기 위해 `true`로 하드코딩했으나, 코드만으로는 의도를 파악하기 어려워 주석을 추가했다.