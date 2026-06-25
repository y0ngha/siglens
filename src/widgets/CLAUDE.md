# `widgets/` — Self-Contained UI Compositions

> Widget은 자기 완결적 UI 단위다. 데이터 fetch, 렌더링, 내부 상호작용을 소유.

## 의존 방향

widgets는 `features/`, `entities/`, `shared/`를 import 가능. **상위 레이어(pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-widget import)

| from | to | 사유 |
|---|---|---|
| `widgets/symbol-page` | `widgets/chart`, `widgets/analysis`, `widgets/fear-greed` 등 | symbol-page는 종목 페이지의 composition widget으로, 여러 위젯의 hook/컴포넌트를 조합. FSD 정석으로는 pages 레이어가 담당한다. 현재는 composition을 `widgets/symbol-page`에 잠정 유지하지만, FSD `pages` 레이어(`src/pages/*`, 라우팅은 `src/app/`에 잔류)는 `eslint.config.mjs`에 정식 element로 이미 예약돼 있어 향후 이관 가능 |
| 각 위젯 | `widgets/symbol-page` | symbol-page 공용 hook 소비. useAssetInfo/useBars는 Spec-2 PR-A에서 각각 entities/ticker, entities/bars로 이전됨 — cross-widget 의존성 해소됨 |

이 예외는 ESLint `from: 'widgets', allow: ['widgets', ...]`로 관리됨.

## barrel 제외 대상

다음 항목은 barrel(index.ts)에서 re-export하지 않음 (server-side 의존성이 barrel을 통해 re-export되면 클라이언트 번들에 포함됨):
- `useDefaultModelId` (symbol-page barrel 제외 — server-side 의존성 이슈)
- `FearGreedHistoricalChart` (lightweight-charts heavy component)

이전 완료:
- `useAssetInfo` → `@/entities/ticker/hooks/useAssetInfo` (Spec-2 PR-A)
- `useBars` → `@/entities/bars/hooks/useBars` (Spec-2 PR-A)
- `BotBlockedError` → `@/shared/lib/BotBlockedError` (Spec-2 PR-A)

소비자는 항목별 실제 경로로 deep import한다:
- `useDefaultModelId` → `@/widgets/symbol-page/hooks/useDefaultModelId`
- `FearGreedHistoricalChart` → `@/widgets/chart/FearGreedHistoricalChart`

## 슬라이스 구조

```
widgets/<name>/
├── ui/               (선택) 서브 컴포넌트
├── hooks/            React hooks
├── utils/            (선택) 순수 유틸
├── sections/         (선택) 섹션 컴포넌트
├── __tests__/        colocated tests
└── index.ts          public API barrel
```
