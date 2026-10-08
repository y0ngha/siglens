# 툴체인 — TypeScript 7 · oxc · React Doctor

이 저장소의 타입체크·린트·포맷·코드 건강 검사 도구와 그 제약을 기록한다.
"왜 이렇게 되어 있는지"를 남기는 문서라, 도구를 바꾸기 전에 여기부터 읽는다.

**Rule IDs.** 반복해서 어겨진 규칙에는 바뀌지 않는 ID(`TC-N`)와 앵커가 붙어 있다. `TOOLCHAIN.md#TC-3`처럼 인용한다.
TC-1~2 타입체크 · TC-3~4 oxfmt · TC-5~6 React Doctor · TC-7~10·35 의존성·프레임워크 업그레이드 ·
TC-11~13 외부 호출 차단 게이트 · TC-14~16 저장소 설정 파일 · TC-17~28 셸·인프라 스크립트 · TC-29~34 codemod.

## Node 런타임 버전 정책

- `.nvmrc`는 **메이저만**(`24`) 적는다. 운영 이미지가 `node:24-alpine`(24 라인 최신 패치를
  추종하는 floating 태그)이라, CI(`setup-node`의 `node-version-file: .nvmrc`)와 로컬도 같은
  라인의 최신 패치를 보게 하려는 것이다. `.nvmrc`만 패치까지 고정하면 시간이 지날수록 CI가
  운영보다 뒤처지는 반대 방향의 불일치가 생긴다.
- 재현성을 위해 고정해야 한다면 `.nvmrc`와 Dockerfile 베이스 이미지(`node:24.x.y-alpine`)를
  **함께** 고정할 것 — 한쪽만 고정하지 않는다.
- 2026-09-24 전환 시점 검증 버전: Node 24.21.0(전체 테스트·빌드·실데이터 standalone).

## TypeScript 7 (네이티브 컴파일러)

- `yarn typecheck` = `tsc --noEmit` (typescript 7.0.2). 전체 타입체크 약 2초.
- **Next 16.3의 빌드타임 타입체크**: Next 16.3부터 `experimental.useTypeScriptCli`가
  기본값이라 `next build`가 TypeScript CLI(`tsc`, TS 7)로 전체 타입체크를 돌린다
  ("Running TypeScript" 단계, 수 초). 레거시 JS API(`typescript/lib/typescript.js`)는
  더 이상 필요 없다.
  - 16.2까지는 Next가 JS API를 require했는데 TypeScript 7은 그 파일을 배포하지 않아서,
    `@typescript/native-preview`를 설치해 두면 Next가 "네이티브 컴파일러 사용 중"으로 보고
    타입체크를 **건너뛰는** 동작에 기대고 있었다(`next/dist/lib/verify-typescript-setup.js`).
    CLI 모드는 이 신호를 보지 않으므로 16.3에서는 빌드에 필요 없다. 패키지는 아래
    에디터 언어 서버 용도로 남겨 두었다(제거해도 빌드는 깨지지 않는다).
- 타입 안전성은 pre-push + CI의 `yarn typecheck`가 담당한다.
- yarn은 4.18 이상이어야 한다. 4.12는 typescript@7에 compat 패치를 적용하려다
  `lib/_tsc.js` ENOENT로 install 자체가 실패한다.

<a id="TC-1"></a>

#### TC-1 — 배포 시점에 실행되는 디렉터리는 두 tsconfig 중 하나가 덮는다

`yarn typecheck`는 `tsc --noEmit && tsc -p tsconfig.scripts.json --noEmit`이다. 메인 `tsconfig.json`은 `scripts/`를
제외하지만(`exclude`) 시드·배포 스크립트는 `tsconfig.scripts.json`이 따로 검사한다. 새로 배포·시드 시점에 실행되는 디렉터리를
만들면 두 설정 중 하나에 반드시 넣는다. 빠지면 코어 API가 바뀌어도(인자 수·누락된 export) 스크립트가 타입 에러 없이 낡아 간다.

<a id="TC-2"></a>

#### TC-2 — 테스트 전용 설정은 운영 `tsconfig.json`에 넣지 않는다

환경·globals·모듈 해석 override 같은 테스트 설정은 Vitest 설정에 둔다. 테스트 호환을 위해 `tsconfig.json`의 `module`을
바꾸면 ESM 전용 의존성이 런타임에서 깨진다.

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

<a id="TC-3"></a>

#### TC-3 — 커밋 전에 `yarn format:check`를 돌린다

포맷터·린터를 건드렸거나 문서·설정을 손으로 고쳤다면 푸시 전에 `yarn format:check`를 통과시키고, 위반은 같은 커밋에서
`yarn format:write`로 해소한다. 푸시 뒤 CI에서 발견하면 라운드가 하나 늘어난다.

<a id="TC-4"></a>

#### TC-4 — 설정 파일은 텍스트로 고치고, 검사 출력의 마지막 줄 대신 종료 코드를 읽는다

JSON 설정(IAM 정책, 설정 파일 등)을 범용 직렬화기로 다시 쓰면 무관한 항목까지 재포맷돼 diff가 부풀고 `format:check`가 실패한다.
의도한 줄만 텍스트로 수정하거나 수정 후 저장소 포맷터를 다시 돌려 diff에 의도한 변경만 남긴다.
그리고 검사 결과는 출력의 마지막 줄이 아니라 **종료 코드**로 판단한다.

## React Doctor

- 로컬: `npx react-doctor@latest`
- CI: `.github/workflows/react-doctor.yml` — 모든 PR에서 실행하고, 그 PR이 **새로
  추가한 error 등급** 지적이 있을 때만 실패시킨다(`scope: changed`).
- 룰 정책: `doctor.config.json`. 끈 룰마다 근거를 주석으로 남긴다.

<a id="TC-5"></a>

#### TC-5 — 브라우저 전역 옆에는 리터럴 `typeof document !== 'undefined'` 가드를 둔다

분석기는 리터럴 스코프에서 하이드레이션 가드를 인식한다. 가드를 `useHydrated()` 같은 헬퍼 훅으로 추출하면
`createPortal(document.body)`가 가드 없는 브라우저 전역으로 지적된다. 헬퍼로 추출하더라도 전역을 쓰는 지점 바로 앞에
리터럴 `typeof` 가드를 함께 둔다.

<a id="TC-6"></a>

#### TC-6 — 의도된 부작용은 기존 `react-doctor-disable-next-line` 관례를 따른다

문서화된 의도적 부작용(인증 핸드오프의 GET 쿠키 설정 등)은 인접 라우트가 쓰는 `// react-doctor-disable-next-line <rule>` 주석으로
억제하고 이유를 적는다. `--scope changed`는 파일을 건드리는 순간 그 파일의 기존 지적을 다시 노출하므로, 파일을 손볼 때 같은 관례를
형제 파일과 맞춘다. (oxlint의 인라인 억제 금지와는 별개의 도구다.)

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

## 의존성·프레임워크 업그레이드

<a id="TC-7"></a>

#### TC-7 — 프레임워크를 올릴 때는 `defaultConfig`를 diff하고 뒤집힌 플래그를 실증한다

구·신 버전의 `defaultConfig`를 비교해 기본값이 뒤집힌 플래그를 목록으로 만든다. 테스트·오프라인 빌드로 관측되지 않는 것
(CDN·라우터·캐시 계약)은 프로덕션 빌드 + 실제 브라우저로 계약을 확인하고, 결과와 재확인 조건을 설정 파일 주석에 남긴다.
확인 없이 넘기면 기본값 변경이 배포 뒤에야 드러난다.

<a id="TC-8"></a>

#### TC-8 — 업그레이드 뒤 타입체크 전에 `*.tsbuildinfo`를 지운다

`incremental: true`는 업그레이드 전 진단을 재사용해 새 타입 에러를 숨긴다(0건이 실제 2건이었던 사례). 의존성을 올린 뒤의 typecheck는
`*.tsbuildinfo`를 지우고 돌린다.

<a id="TC-9"></a>

#### TC-9 — SDK를 올리면 Dockerfile의 수동 `COPY` 목록을 확인한다

런타임 이미지가 `node_modules` 하위 경로를 수동으로 `COPY`하면, SDK가 내부 의존을 없앴을 때 없는 경로를 복사하다 이미지 빌드가 깨진다.
PR CI는 Docker 빌드를 돌리지 않으므로, SDK 업그레이드 때는 runner에 실제로 복사되는 목록만 담은 격리 디렉터리에서 요청을 보내 확인한다.

<a id="TC-10"></a>

#### TC-10 — 벤더 입력 형식을 파싱하는 테스트 더블을 감사한다

LLM·외부 서비스로 전달되는 메시지 형식이 바뀔 수 있는 의존성(core 버전, provider SDK)을 올릴 때는 그 형식을 파싱·검증하는
fake·stub·테스트 더블을 모두 찾아 변경 노트와 대조한다(예: e2e의 fake LLM). 실구현 경로만 훑으면 놓치기 쉬우므로 e2e를 돌려 확인한다.

<a id="TC-35"></a>

#### TC-35 — 프레임워크 업그레이드 뒤 버전 고정 소스 인용을 다시 검증한다

코드 주석의 `16.x.y 기준 검증` 문구와 `next/dist/...:줄번호` 인용은 업그레이드 뒤 조용히 낡는다. 올린 뒤
`grep -rn "16\.[0-9]*\.[0-9]*\|next/dist/"`로 전부 찾아 각 인용을 새 버전의 소스에서 다시 확인하고, 줄 번호와 버전 문구를 함께 고친다.
❌ 버전만 올리고 `next/dist/...:540` 인용을 그대로 둔다
✅ 새 버전 소스에서 줄을 다시 찾아 고치고, 실측값은 측정한 버전을 명시한다

## 외부 호출 차단 게이트

<a id="TC-11"></a>

#### TC-11 — 차단 게이트는 보호 경로에서 닿는 모든 외부 호스트를 덮는다

오프라인 빌드·킬 스위치 게이트를 만들 때 작업 설명에 이름이 나온 서비스만 막으면, 캐시 클라이언트가 꺼질 때 다른 외부 호스트
(예: 시세 공급자)로 조용히 폴백해 매 빌드마다 실서비스를 호출한다. 보호 경로에서 도달 가능한 호스트를 전수 확인하고,
게이트를 끈 상태로 prerender가 막히는지로 검증한다.

<a id="TC-12"></a>

#### TC-12 — 게이트는 서드파티 클라이언트 위에 두고, 실제 빌드로 검증한다

라이브러리가 주입받는 `fetch` 훅 안에서 던지면, 라이브러리가 사전 초기화(크럼·쿠키 획득 등)를 하는 메서드에서는 우아하게 실패하는 대신
빌드가 멈출 수 있다. 클라이언트 생성 단계(또는 메서드 호출 이전)에서 막고, fetch 수준 가드는 백스톱으로만 둔다. 단위 테스트가 아니라 실제 빌드로 검증한다.

<a id="TC-13"></a>

#### TC-13 — 의존성이 서비스 env를 직접 읽는지 grep하고 그쪽 env도 비운다

외부 패키지가 `process.env.<SERVICE>_*`에서 직접 클라이언트를 만들면 앱 수준 게이트를 우회한다. 게이트를 구현할 때 의존성 전체에서
해당 서비스의 env 직접 읽기를 grep하고, env 비우기·override가 그 경로까지 닿는지 확인한다(프레임워크의 env 로더가 미리 비워 둔 값을 덮어쓰지 않는지도).

## 저장소 설정 파일

<a id="TC-14"></a>

#### TC-14 — `.gitignore` 허용목록은 스크립트·추적 파일과 같은 변경에서 맞춘다

스크립트를 추가하면 `!scripts/<name>` 예외를, 삭제하면 낡은 예외를 같은 변경에서 정리한다. 어긋나면 새 스크립트가 git에 보이지 않거나
어떤 파일과도 맞지 않는 예외가 남는다. 확인은 `git status`로 한다.

<a id="TC-15"></a>

#### TC-15 — 끝에 슬래시가 붙은 ignore 패턴은 디렉터리만 매칭한다

`/.claude/agent-memory/`는 디렉터리만 무시하므로, 워크트리 훅이 만드는 심볼릭 링크는 그대로 커밋된다. 심볼릭 링크가 올 수 있는 경로는
슬래시 없는 패턴을 함께 둔다(이 저장소는 `/.claude/agent-memory`).

<a id="TC-16"></a>

#### TC-16 — 저장소에 올라가는 도구 설정에 기여자 개인의 절대 경로를 쓰지 않는다

훅·스크립트 설정은 저장소 상대 경로로 쓴다. 한 사람의 로컬 경로를 박으면 다른 환경에서 훅이 조용히 동작하지 않는다.

## 셸·인프라 스크립트

`infra/aws/**` 같은 스크립트는 공개 저장소에 있다. 규칙은 일반 형태로 적고 리소스 이름·ID는 쓰지 않는다.

<a id="TC-17"></a>

#### TC-17 — `sed` 구분자는 치환 값에 나올 수 없는 문자로 고른다

경로·URL·태그는 결국 `/`를 포함한다. `|`를 쓰되 값이 `|`를 포함할 수 있으면 먼저 이스케이프한다.

```
❌ sed "s/__IMAGE_TAG__/$TAG/" file     # 태그가 v2/feature면 깨진다
✅ sed "s|__IMAGE_TAG__|$TAG|" file
```

<a id="TC-18"></a>

#### TC-18 — `set -e` 아래에서 오래 걸리는 명령은 선행 조건 뒤에 둔다

느린 부팅 명령이 타임아웃으로 스크립트를 끝내면 뒤에 오는 유닛 활성화가 실행되지 않아 인스턴스 교체가 무한히 반복될 수 있다.
순서는 선행 조건 활성화 → 블로킹 명령 → 의존 작업이다.

<a id="TC-19"></a>

#### TC-19 — 변수의 생산자와 소비자를 함께 맞춘다

`set -u` 아래에서는 정의되지 않은 변수가 첫 사용 전에 스크립트를 중단시킨다. 변수를 쓰는 스크립트를 지우면 그 변수를 참조하는 모든 호출자를
찾아 고치거나 지역에서 재구성한다.

<a id="TC-20"></a>

#### TC-20 — 필수 환경 변수는 `: ${VAR?}`로 시작 시점에 검증한다

리소스 생성이 선택적 env에 의존하면(예: 구독 주소가 없는 알림 토픽) 메시지가 구독자 0인 곳으로 조용히 사라진다.
문서화하고 필수로 만들어 없으면 즉시 실패하게 한다.

<a id="TC-21"></a>

#### TC-21 — 제한 재시도 루프 뒤에는 조건 확인을 둔다

`for i in {1..10}; do ...; done; echo Success`는 게이트가 아니라 지연일 뿐이다. 루프 뒤에 보호하는 조건을 다시 확인하거나 실패로 종료한다.

<a id="TC-22"></a>

#### TC-22 — 스키마 검증 JSON에는 주석 키를 넣지 않는다

`additionalProperties: false` 스키마는 `"_comment"` 같은 키를 거부한다. 설명은 셸 스크립트 주석이나 별도 문서에 둔다.

<a id="TC-23"></a>

#### TC-23 — 이름 기준 upsert는 옛 이름의 명시적 삭제와 짝을 이룬다

알람 같은 리소스를 새 이름으로 바꿀 때 upsert만 하면 옛 리소스가 남아 없애려던 잡음을 계속 낸다. 옛 이름 삭제를 같은 변경에 넣는다.

<a id="TC-24"></a>

#### TC-24 — 런타임 설정은 재부팅 뒤에도 살아남고 임시 저장소에 의존하지 않는다

`tmpfs`(`/run`)에만 쓴 설정은 재부팅 때 사라진다. 지속 설정은 부팅 때마다 외부 저장소에서 가져오고(예: 서비스 시작 전 단계), 가져올 수 없으면
중단하지 말고 우아하게 낮추거나 해당 단계를 건너뛴다.

<a id="TC-25"></a>

#### TC-25 — CLI 출력은 구조화된 형태로 질의하고 존재/부재 상태를 모두 검증한다

텍스트 출력을 공백 패딩으로 파싱하지 않는다(여러 값은 탭으로 구분되어 재실행이 중복 오류로 죽는다). JMESPath 같은 질의로 정확한 항목을 뽑고,
모의 CLI 하네스로 "없음"과 "있음" 두 상태를 모두 재현해 본다.

<a id="TC-26"></a>

#### TC-26 — 중단·실패 경로는 0이 아닌 종료 코드를 반환한다

성공 0, 중단·실패 1. 중단 경로와 실패 건수가 있는 경로가 0을 반환하면 CI 파이프라인에서 오류가 숨는다.

<a id="TC-27"></a>

#### TC-27 — 여러 스크립트에 걸친 변경은 실행 순서를 각 스크립트 자리에 적는다

한 변경이 스크립트·저장소 여러 곳에 나뉘면(옛 항목 삭제 → 새 항목 연결) 일부만 실행했을 때 공백이 생긴다. 각 스크립트가 실행되는 위치에 순서를 문서화한다.

<a id="TC-28"></a>

#### TC-28 — 예산·한도 경고는 한도를 넘기는 스크립트에 둔다

한도를 정하는 스크립트에만 경고를 적으면 실제로 한도를 깨뜨리는 스크립트를 고치는 사람은 보지 못한다.

## 코드 변환 스크립트(codemod)

<a id="TC-29"></a>

#### TC-29 — 삽입 앵커는 줄 접두사가 아니라 완전한 구문 단위에 건다

`^import` 줄 단위 삽입은 여러 줄 import 블록 안이나 `'use client'` 지시문 위에 코드를 넣는다. 구문 전체(`^import\b[\s\S]*?;$`)를 매칭하고,
지시문은 별도로 감지한 뒤 앵커를 잡는다.

<a id="TC-30"></a>

#### TC-30 — 중복 판정은 맨 식별자가 아니라 모듈 경로와 문장 경계로 한다

식별자만 검사하면 JSX에 이미 삽입한 같은 이름에 걸려 중복 import를 만든다(oxlint에는 `no-duplicate-imports`가 없어 CI가 못 잡는다).

<a id="TC-31"></a>

#### TC-31 — 자동 재작성은 주석(leading trivia)을 보존한다

`getText()`는 앞쪽 주석을 제외하므로 mock 문이나 팩토리 속성의 설명 주석이 조용히 사라진다. 전체 AST 순회로 주석을 옮기고, 변환 뒤 삭제된 주석 줄을 직접 검토한다.

<a id="TC-32"></a>

#### TC-32 — 의도적인 mock seam은 코드 변환에서 보존한다

테스트에서 의존성을 독립적으로 mock하려고 만든 재export는 배럴처럼 보여도 지우면 안 된다. 변환 스크립트에 허용목록을 두고 seam 파일을 제외한다.

<a id="TC-33"></a>

#### TC-33 — 치환마다 대상 grep으로 검증한다

여러 치환을 하나의 `assert content != original`로 검사하면, 포맷터가 줄을 바꿔 놓아 일부 치환이 적용되지 않아도 통과한다.
치환마다 기대 문자열을 `grep`으로 확인한다.

<a id="TC-34"></a>

#### TC-34 — 변환 뒤 바뀐 모든 파일을 다시 스캔한다

블록 안으로 들어간 import, 밀려난 지시문, 만들어진 중복을 `grep '^import'` 등으로 점검한다.
