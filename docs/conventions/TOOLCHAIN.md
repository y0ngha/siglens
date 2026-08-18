# 툴체인 — TypeScript 7 · oxc · React Doctor

이 저장소의 타입체크·린트·포맷·코드 건강 검사 도구와 그 제약을 기록한다.
"왜 이렇게 되어 있는지"를 남기는 문서라, 도구를 바꾸기 전에 여기부터 읽는다.

## TypeScript 7 (네이티브 컴파일러)

- `yarn typecheck` = `tsc --noEmit` (typescript 7.0.2). 전체 타입체크 약 2초.
- **Next 16.2와의 제약**: Next의 빌드타임 타입체크는 레거시 JS API
  (`typescript/lib/typescript.js`)를 require하는데 TypeScript 7은 그 파일을
  배포하지 않는다. Next는 `@typescript/native-preview`가 설치돼 있으면
  "네이티브 컴파일러 사용 중"으로 보고 자기 타입체크를 건너뛴다
  (`next/dist/lib/verify-typescript-setup.js`). 그래서 devDependencies의
  `@typescript/native-preview`는 **미사용 패키지가 아니라 이 신호용**이다.
  제거하면 `yarn build`가 깨진다(next.config.ts 상단 주석에도 명시).
- 타입 안전성은 pre-push + CI의 `yarn typecheck`가 담당한다.
- yarn은 4.18 이상이어야 한다. 4.12는 typescript@7에 compat 패치를 적용하려다
  `lib/_tsc.js` ENOENT로 install 자체가 실패한다.

### 에디터 설정 (중요)

TypeScript 7 패키지는 **`tsserver`를 배포하지 않는다** — `bin/`에 `tsc`뿐이다.
그래서 에디터가 워크스페이스 TypeScript(`node_modules/typescript/lib`)를 언어 서버로
쓰도록 설정돼 있으면 서버가 뜨지 못해 파일마다 `Cannot find name 'Promise'` 같은
가짜 오류가 뜬다(CLI `yarn typecheck`는 멀쩡히 통과한다).

- VS Code/Cursor: `.vscode/settings.json`에서 tsdk 경로 지정을 **제거**하고 에디터
  번들 TypeScript를 쓰게 둔다(`.vscode/`는 gitignore라 각자 로컬에서 조치).
- 네이티브 언어 서버를 원하면 "TypeScript (Native Preview)" 확장 + 
  `"typescript.experimental.useTsgo": true` — 이미 설치된 `@typescript/native-preview`의
  `tsgo`가 LSP로 동작한다.
- 어느 쪽이든 타입 판정의 기준은 `yarn typecheck`(tsc 7)와 CI다.

## oxlint (eslint 대체)

TypeScript 7 도입으로 typescript-eslint가 로드 단계에서 죽어(`typescript-estree`:
`Cannot read properties of undefined (reading 'Cjs')`) eslint 스택을 쓸 수 없다.
oxlint는 자체 파서라 무관하고, 저장소 전체 린트가 1초대에 끝난다.

- 설정: `.oxlintrc.json`
- **FSD 레이어 규칙**은 eslint-plugin-boundaries 대신 레이어별 override의
  `no-restricted-imports` regex로 표현한다. oxlint는 override 간 같은 룰의 옵션을
  머지하지 않고 **마지막 매치가 이긴다** — 그래서 "deep import 금지 + 레이어 방향
  금지 + @e2e 금지"를 레이어별 override 하나에 함께 담는다. 규칙을 추가할 때 이
  성질을 잊으면 앞선 override가 통째로 사라진다.
- 인라인 억제(`oxlint-disable-*`)는 쓰지 않는다. 룰이 우리 코드에 맞지 않으면
  룰 옵션(예: `no-redundant-roles`의 태그 예외)이나 파일 범위 override로 표현하고
  근거를 주석으로 남긴다.

## oxfmt (prettier 대체)

- 설정: `.oxfmtrc.json` (`oxfmt --migrate=prettier`로 이관)
- JS/TS뿐 아니라 JSON·CSS·YAML·Markdown까지 포맷한다. tailwind 클래스 정렬은
  내장 `sortTailwindcss`가 담당하며 Tailwind v4의 stylesheet 경로를 받는다.
  prettier-plugin-tailwindcss는 그 경로를 못 받아 커스텀 테마 유틸을
  "미지 클래스"로 취급했었다 — 그래서 전환 시 클래스 순서가 크게 바뀌었다.
- `.gitignore`의 `!.yarn/releases` 부정 패턴 때문에 yarn 번들이 포맷 후보로
  올라온다. `.oxfmtrc.json`의 `ignorePatterns`에서 `.yarn/**`을 명시 제외한다.

## React Doctor

- 로컬: `npx react-doctor@latest`
- CI: `.github/workflows/react-doctor.yml` — 모든 PR에서 실행하고, 그 PR이 **새로
  추가한 error 등급** 지적이 있을 때만 실패시킨다(`scope: changed`).
- 룰 정책: `doctor.config.json`. 끈 룰마다 근거를 주석으로 남긴다.

### 점수에 대해 알아 둘 것 (실측)

점수는 **서버 API가 진단 목록만 받아 계산**한다(`calculateScore` → `requestScore`).
로컬 공식은 없고, 코드 크기로 정규화하지도 않는다. 2026-08-18 기준 실측:

| 상태 | 점수 |
|---|---|
| 툴체인 전환 전 | 65 |
| 1차 실수정 + 설정 정리 | 81 |
| 2차 실수정(아래) 후 **현재** | **85 (Great)**, error 0 |
| Bugs·Performance·Accessibility를 전부 0으로 만들면 | 90 |
| 진단 0건 | 100 |

- **suppression은 점수를 바꾸지 않는다.** `ignore.rules` / `ignore.overrides`로
  걸러도 점수 API는 원본 진단을 받는다. 반대로 `rules: {x: "off"}`(룰 미실행)과
  `ignore.files`(스캔 제외)는 진단 자체가 생기지 않아 점수에 반영된다.
- **카테고리 가중치가 크게 다르다.** Maintainability는 134건이 있어도 1점 남짓이고
  (수동 메모화 109건을 전부 지워도 점수 변화 0), Security는 6건이 8점을 물었다.
- `.github/**`를 스캔에서 제외한 이유: `build-pipeline-secret-boundary`가
  "시크릿이 있는 잡에서 install이 돈다"를 지적하는데, GitHub Packages(프라이빗)에서
  `@y0ngha/siglens-core`를 받으려면 install 시점 토큰이 필수라 구조적으로 해소가
  불가능하다. 실제 가능한 완화는 코드에 반영했다 — 토큰을 job 전역 env에서 install
  스텝으로 좁혔고, 순수 JS 체크 잡은 `--mode=skip-build`로 시크릿이 있는 동안
  패키지 lifecycle 코드를 실행하지 않는다.

### 2차에서 실제로 고친 것

- **분석 쿼리 4종**(congress/financials/fundamental/options): `enabled: false` + effect에서
  `refetch()` → `enabled` 기반으로. 포커스/재연결 재요청을 꺼서 "실패 후 창 포커스만으로
  AI 분석이 다시 도는" 경로를 차단했다.
- **usePersistentState**: 마운트 effect 복원 → `useSyncExternalStore`. 복원 렌더가 사라지고,
  같은 key를 쓰는 인스턴스가 자동 동기화되며 다른 탭 변경도 반영된다.
- **useSectorSignalState**: URL 딥링크 복원을 effect → 첫 렌더 초기화로(이 패널은
  `useSearchParams` CSR bailout이라 하이드레이션 불일치가 없다).
- **채팅 메시지 key**: `ChatMessage`(core 소유 타입)에 id가 없어 표시 계층에서 `uiId`를
  부여하고 LLM 전송·저장 전에 제거한다. 인덱스 key 제거.
- **모달 2종**(ContactDialog, IndicatorSettingsModal): 네이티브 `<dialog>` + `showModal()`.
  포커스 트랩·Esc·비활성 배경을 브라우저에 위임하고 `useFocusTrap`/`useEscapeKey`/
  `useOnClickOutside` 조합을 걷어냈다. 배경 클릭 닫기는 `useDialog`가 dialog 엘리먼트에
  직접 리스너를 붙인다(소비자 JSX에 클릭 핸들러를 두면 a11y 룰에 걸린다).
  jsdom은 `showModal`을 구현하지 않아 `vitest.setup.dom.ts`에 최소 폴리필을 뒀다.

### 90점까지 남은 항목(후속 과제)

남은 9건이 5점을 물고 있다. 전부 "런타임 회귀가 의심되는" 리팩터링이거나 분석기 오탐이라
이 PR에서는 손대지 않았다.

| 항목 | 건수 | 왜 미뤘나 |
|---|---|---|
| `no-pass-data-to-parent` 외 2종 (ChartContent `notifyMobileContent`) | 3 | 모바일 바텀시트 내용을 부모 상태로 올리는 구조다. 부모가 Suspense 경계 **밖**에서 시트를 렌더해 타임프레임 전환 시에도 내용이 유지되는 것이 의도된 설계라(포털로 바꾸면 서스펜드 중 내용이 사라진다) 구조 변경 없이는 못 없앤다 |
| `no-pass-data-to-parent`/`no-pass-live-state-to-parent` (useSelectedModel) | 2 | 모델 선택이 매 로드 DEFAULT로 강등되던 회귀(PR #713)를 tier 확정 게이트로 막은 파일이다. 파생 상태 재작성이 더 안전할 수 있지만 별도 PR + 실증이 필요하다 |
| `no-pass-data-to-parent` (useMovingAverageOverlay, useIndicatorTranslationTrigger) | 2 | 분석기 오탐. 각각 lightweight-charts 시리즈에 데이터를 넣는 명령형 동기화와, 마운트 1회 fire-and-forget 서버 액션 트리거다 |
| `no-adjust-state-on-prop-change` (useAnalysis) | 2 | tier 확정·보유종목 하이드레이션·warm 캐시 결과가 얽힌 레이스 처리다. 상태 조정과 재제출(side effect)이 한 effect에 묶여 있어 렌더 파생으로 옮길 수 없다 |
