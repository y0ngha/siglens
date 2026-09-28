# `widgets/` — Self-Contained UI Compositions

> Widget은 자기 완결적 UI 단위다. 데이터 fetch, 렌더링, 내부 상호작용을 소유.

## 의존 방향

widgets는 `features/`, `entities/`, `shared/`를 import 가능. **상위 레이어(pages/views, app)를 import할 수 없다.**

## 의도적 예외 (cross-widget import)

이 예외는 oxlint `no-restricted-imports`의 `from: 'widgets', allow: ['widgets', ...]`로 관리됨.
현재 유지되는 프로덕션 cross-widget 엣지는 아래 네 개뿐이다:

- **`fear-greed → chart`**: `FearGreedPage.tsx`가 `@/widgets/chart/FearGreedHistoricalChart`를 deep import (barrel 미포함 heavy component)
- **`overall → news`**: `OverallContent.tsx`가 `@/widgets/news` barrel에서 `useNewsAnalysisTrigger`, `useWaitForNewsCards`를 소비
- **`agent-chat → layout`**: `ChatShell.tsx`가 `@/widgets/layout`의 `useHideOnScrollDown`을 소비 (모바일 대화 바를 사이트 헤더와 같은 스크롤-숨김 패턴으로 맞춤)
- **`market-fear-greed → fear-greed`**: `MarketFearGreedPage.tsx`/`MarketFearGreedComparison.tsx`가 `@/widgets/fear-greed`의 `FearGreedGauge`를 재사용한다

규칙 완전 제거는 위 컴포넌트들의 `shared/`·`entities/` 이전을 선행해야 하므로 보류.

## barrel 제외 대상

다음 항목은 barrel(index.ts)에서 re-export하지 않음 (server-side 의존성이 barrel을 통해 re-export되면 클라이언트 번들에 포함됨):
- `FearGreedHistoricalChart` (lightweight-charts heavy component)

소비자는 항목별 실제 경로로 deep import한다:
- `FearGreedHistoricalChart` → `@/widgets/chart/FearGreedHistoricalChart`
