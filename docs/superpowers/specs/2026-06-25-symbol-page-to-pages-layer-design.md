# Spec-2 — symbol-page 조합 로직을 FSD `pages` 레이어로 승격

- 작성일: 2026-06-25
- 상태: 설계(방향) — 전용 brainstorming/plan에서 상세화
- 선행: 메인 spec(`2026-06-25-vercel-removal-and-refactor-audit-design.md`)의 P0~P2 안정화 후 착수
- 위험도: 고 (수십 파일 import 경로 이동)

## 문제

cross-cutting 아키텍처 감사(Opus 4.8)가 확인한 가장 큰 구조적 결합점:

1. **양방향 widget 사이클**: `symbol-page` ⇄ `analysis`.
   - `widgets/symbol-page/ChartContent.tsx:8` → `@/widgets/analysis`(AnalysisPanel), `SymbolLayoutHeader.tsx:10`(ModelSelector).
   - `widgets/analysis/AnalysisPanel.tsx:33` → `@/widgets/symbol-page`(`useSymbolPageContext`) (+ `AnalysisProgress.tsx:4`, `AnalysisToast.tsx:4`).
2. **광범위 fan-in**: 9개 위젯이 `symbol-page` barrel에서 공통 hook(`useDefaultModelId`, `useBars`, `useAssetInfo` 등)을 deep-path로 소비.

이는 FSD에서 `pages` 레이어가 담당해야 할 **composition root**가 `widgets`에 들어앉은 결과다. ESLint는 이를 허용하려고 `widgets → widgets` 예외를 열어뒀다(아래).

## 현재 ESLint 예외 (재봉인 대상)

`eslint.config.mjs`:

- 144-153행: `from: { type: 'widgets' }, allow: [{ to: { type: 'widgets' } }, …]` — 주석에 **전적으로 symbol-page 조합용**이라 명시("symbol-page가 chart/analysis/fear-greed 조합, fundamental/news/options/overall이 symbol-page barrel에서 공통 hook 소비").
- 212-214행: `no-restricted-imports`의 `src/widgets/**` ignore — widget 간 deep-path cross-import 허용(Phase 7 우회).
- 119행: `{ type: 'pages', pattern: 'src/pages/*' }` — **pages 레이어는 이미 예약됨**(미사용).

## ⚠️ 열린 이슈 (전용 brainstorming에서 결정)

- **디렉토리 네이밍 충돌**: Next.js App Router 프로젝트에서 `src/pages/`에 파일을 추가하면 **Pages Router가 활성화**된다(eslint.config.mjs:117-118 주석도 경고). FSD `pages` 레이어 실디렉토리를 `src/pages/`로 쓸 수 없을 가능성이 높음 → `src/views/` 또는 `src/screens/` 등 대체 네이밍 + boundaries `pattern` 갱신 필요. **착수 전 Next.js 라우팅 충돌 실증 필수**(추측 금지).

## 목표 구조 (방향)

- `src/<pages-layer>/symbol/`(네이밍 미정)에 composition root를 둔다:
  - `SymbolPageProvider`/context를 widgets에서 이 레이어로 이동.
  - 페이지(`app/[symbol]/**`)는 위젯을 직접 조합하는 대신 이 레이어를 소비.
  - 위젯(`analysis` 등)은 context를 **하향**으로 받음(props/레이어 제공) → `analysis → symbol-page` 역방향 import 제거.
- 공통 hook(`useDefaultModelId`/`useBars`/`useAssetInfo`)의 소유권을 재배치: 다수 위젯이 공유하면 `entities`/`shared` 또는 pages 레이어 컨텍스트로 이동하여 widget→widget fan-in 제거.

## 재봉인 (완료 시)

- `widgets → widgets` allow에서 `{ to: { type: 'widgets' } }` 제거.
- `no-restricted-imports`의 `src/widgets/**` ignore 제거(또는 최소화).
- **선검증**: symbol-page 외 다른 widget↔widget import가 없는지 전수 확인 후에만 제거(news 패밀리 등 다른 cross-import 존재 여부 실측).

## Behavior-preservation

- 순수 구조 이동: 컴포넌트 트리·렌더 출력·context 값 동일. import 경로/레이어만 변경.
- 광범위하므로 단계적 PR(스캐폴드 → context 이동 → 역방향 import 제거 → fan-in 재배치 → ESLint 재봉인)로 쪼개고, 각 단계 전체 test+build+e2e 게이트.

## 비범위

- 기능 변경/렌더 변경 없음. 순수 레이어 재배치.
