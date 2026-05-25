# `widgets/` — Self-Contained UI Compositions

> Widget은 자기 완결적 UI 단위다. 데이터 fetch, 렌더링, 내부 상호작용을 소유.

## 의존 방향

widgets는 `features/`, `entities/`, `shared/`를 import 가능. **상위 레이어(pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-widget import)

| from | to | 사유 |
|---|---|---|
| `widgets/symbol-page` | `widgets/chart`, `widgets/analysis`, `widgets/fear-greed` 등 | symbol-page는 종목 페이지의 composition widget으로, 여러 위젯의 hook/컴포넌트를 조합. FSD 정석으로는 pages 레이어가 담당하지만, Next.js App Router에서 src/pages/ 사용 시 Pages Router 충돌 위험으로 widget에 유지 |
| 각 위젯 | `widgets/symbol-page` | useAssetInfo, useBars 등 symbol-page 공용 hook 소비. barrel 제외 대상(server-side 의존성 이슈)은 deep import 유지 |

이 예외는 ESLint `from: 'widgets', allow: ['widgets', ...]`로 관리됨.

## barrel 제외 대상

다음 hook은 barrel(index.ts)에서 re-export하지 않음 (server-side 의존성이 barrel을 통해 re-export되면 클라이언트 번들에 포함됨):
- `useAssetInfo`, `useBars`, `useDefaultModelId`
- `FearGreedHistoricalChart` (lightweight-charts heavy component)

소비자는 `@/widgets/<slice>/hooks/<name>` deep path로 import.

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
