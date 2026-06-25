# `widgets/` — Self-Contained UI Compositions

> Widget은 자기 완결적 UI 단위다. 데이터 fetch, 렌더링, 내부 상호작용을 소유.

## 의존 방향

widgets는 `features/`, `entities/`, `shared/`를 import 가능. **상위 레이어(pages/views, app)를 import할 수 없다.**

## 의도적 예외 (cross-widget import)

cross-widget import는 현재 허용되지만, `symbol-page` 슬라이스는 Spec-2 PR-B2에서 제거됨:

- **이전 예외 (제거됨):** `widgets/symbol-page` → `widgets/chart`, `widgets/analysis`, `widgets/fear-greed` 등
  - 이유: `symbol-page` 컴포지션이 FSD `pages` 레이어(`src/views/symbol/`)로 이관됨 (Spec-2 PR-B2)
  - 관련 hook은 `src/features/symbol-model/`로, CrossLinkCards는 `src/shared/ui/`로 이동

이 예외는 ESLint `from: 'widgets', allow: ['widgets', ...]`로 관리됨. (widgets 간 cross-import는 여전히 허용 — PR-C에서 재검토 예정)

## barrel 제외 대상

다음 항목은 barrel(index.ts)에서 re-export하지 않음 (server-side 의존성이 barrel을 통해 re-export되면 클라이언트 번들에 포함됨):
- `FearGreedHistoricalChart` (lightweight-charts heavy component)

이전 완료:
- `useAssetInfo` → `@/entities/ticker/hooks/useAssetInfo` (Spec-2 PR-A)
- `useBars` → `@/entities/bars/hooks/useBars` (Spec-2 PR-A)
- `BotBlockedError` → `@/shared/lib/BotBlockedError` (Spec-2 PR-A)
- `useAnalysisProgress`, `ANALYSIS_PHASES`, `ANALYSIS_TIPS` → `@/widgets/analysis/hooks/useAnalysisProgress` (Spec-2 PR-B1)
- `CooldownNotice` → `@/widgets/analysis/model/types` (Spec-2 PR-B1)
- `symbol-page` 전체 → `src/views/symbol/` (컴포지션), `src/features/symbol-model/` (모델 상태), `src/shared/ui/CrossLinkCards` (공용 UI) (Spec-2 PR-B2)

소비자는 항목별 실제 경로로 deep import한다:
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
