# 툴체인 — TypeScript 7 · oxc · React Doctor

이 저장소의 타입체크·린트·포맷·코드 건강 검사 도구와 그 제약을 기록한다.
"왜 이렇게 되어 있는지"를 남기는 문서라, 도구를 바꾸기 전에 여기부터 읽는다.

**Rule IDs.** ID 규칙은 root `CLAUDE.md` "Rule IDs and references"를 따른다. `TOOLCHAIN.md#TC-3`처럼 인용한다.

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
  - `@typescript/native-preview`는 빌드에 필요 없고 아래 에디터 언어 서버 용도로만 남아 있다(제거해도 빌드는 깨지지 않는다).
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
- 인라인 억제 금지는 `CONVENTIONS.md` "Lint and guard rules"가 정한다. 맞지 않는 룰은 룰 옵션(예: `no-redundant-roles`의
  태그 예외)이나 파일 범위 override로 표현하고 근거를 주석으로 남긴다.

## oxfmt (prettier 대체)

- 설정: `.oxfmtrc.json` (`oxfmt --migrate=prettier`로 이관)
- JS/TS뿐 아니라 JSON·CSS·YAML·Markdown까지 포맷한다. tailwind 클래스 정렬은
  내장 `sortTailwindcss`가 담당하며 Tailwind v4의 stylesheet 경로를 받는다.
- `.gitignore`의 `!.yarn/releases` 부정 패턴 때문에 yarn 번들이 포맷 후보로
  올라온다. `.oxfmtrc.json`의 `ignorePatterns`에서 `.yarn/**`을 명시 제외한다.

<a id="TC-3"></a>

#### TC-3 — 커밋 전에 `yarn format:check`를 돌린다

포맷터·린터를 건드렸거나 문서·설정을 손으로 고쳤다면 푸시 전에 `yarn format:check`를 통과시키고, 위반은 같은 커밋에서
`yarn format:write`로 해소한다. 푸시 뒤 CI에서 발견하면 라운드가 하나 늘어난다.
포맷터는 oxfmt뿐이다. `prettier`를 직접 돌리면 무관한 파일까지 다시 쓰이므로 항상 `yarn format:check`·`yarn format:write`를 쓴다.

<a id="TC-4"></a>

#### TC-4 — 설정 파일은 텍스트로 고치고, 검사 출력의 마지막 줄 대신 종료 코드를 읽는다

JSON 설정(IAM 정책, 설정 파일 등)을 범용 직렬화기로 다시 쓰면 무관한 항목까지 재포맷돼 diff가 부풀고 `format:check`가 실패한다.
의도한 줄만 텍스트로 수정하거나 수정 후 저장소 포맷터를 다시 돌려 diff에 의도한 변경만 남긴다.
그리고 검사 결과는 출력의 마지막 줄이 아니라 **종료 코드**로 판단한다.

## React Doctor

- 로컬: `yarn doctor`(= `react-doctor --no-supply-chain`). 상세는 `yarn doctor --verbose`,
  PR 게이트 재현은 `yarn doctor --scope changed --base master --verbose`.
- CLI는 `react-doctor@0.9.18`로 devDependency에 **정확 고정**돼 있다(룰 세트가 버전마다 바뀌어
  점수가 흔들리는 것을 막는다). 올릴 때는 `yarn add -D -E react-doctor@<버전>` 후 전체 진단을
  다시 읽고 `doctor.config.json`의 근거를 재확인한다.
- CI는 액션 메이저 태그(`millionco/react-doctor@v2`)를 쓰며 액션에 번들된 CLI가 돈다 —
  로컬 고정 버전과 CI 버전이 어긋날 수 있으니, CI 결과가 로컬과 다르면 버전부터 본다.
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
로컬 공식은 없고, 코드 크기로 정규화하지도 않는다.

- **suppression은 점수를 바꾸지 않는다.** `ignore.rules` / `ignore.overrides`로
  걸러도 점수 API는 원본 진단을 받는다. 반대로 `rules: {x: "off"}`(룰 미실행)과
  `ignore.files`(스캔 제외)는 진단 자체가 생기지 않아 점수에 반영된다.
- **카테고리 가중치가 크게 다르다.** Maintainability는 134건이 있어도 1점 남짓이고
  (수동 메모화 109건을 전부 지워도 점수 변화 0), Security는 6건이 8점을 물었다.
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

<a id="TC-37"></a>

#### TC-37 — lightweight-charts를 올리면 렌더러 내부에 기댄 코드를 실물 차트로 다시 확인한다

`src/widgets/chart/utils/extendedGapChart.ts`는 **공개 API가 아닌 렌더러 동작**에 기댄다 — 5.2의 `walkLine`이 점 `i-1 → i` 선분을
`i-1` 점의 점별 스타일로 칠하고(그래서 앞 점을 투명으로 만들면 선분만 사라진다), 선이 안 보이는 시리즈(`lineVisible: false`)의
마커도 같은 점별 스타일을 쓰며, `crosshairMarkerBackgroundColor`가 비면 마커 배경이 점별 색을 따른다는 것이다. 마이너 업그레이드에서도
이 동작이 바뀌면 단위 테스트(목 시리즈)는 그대로 초록이고 **차트만** 조용히 틀린다.
올릴 때는 `node_modules/lightweight-charts/dist/lightweight-charts.development.mjs`에서 `walkLine`의 스타일 전환 위치와
`drawSeriesPointMarkers`·`_private__markerBackgroundColor`를 다시 읽고, 로컬 스택에서 인트라데이 차트(RSI·볼린저 영역·파라볼릭 SAR·
스퀴즈 점)를 열어 시간외 구간에서 선이 끊기고 점·크로스헤어 마커가 살아 있는지 눈으로 확인한 뒤, 확인한 버전을 그 파일 JSDoc에 적는다
(현재 5.2.1).
❌ 버전만 올리고 `yarn test`가 초록이니 넘어간다
✅ 렌더러 소스를 다시 읽고 실물 차트에서 끊김·마커를 확인한 뒤 JSDoc의 검증 버전을 고친다

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

## 지원 브라우저와 내장 API

<a id="TC-36"></a>

#### TC-36 — 지원 하한은 Chrome·Edge 109, iOS Safari 15다. 그보다 새 내장 API는 폴리필에 넣은 것만 쓴다

Next(SWC)는 문법만 내리고 `Array.prototype.toSorted` 같은 내장 메서드는 채우지 않는다. 지원 하한 브라우저에 없는
내장 API를 클라이언트에 닿는 코드에서 그대로 쓰면 그 브라우저에서 `… is not a function`으로 깨진다(Chrome 109는
Windows 7/8.1에서 올릴 수 있는 마지막 Chrome이라 실제 사용자가 있다).

- **지원한다:** Chrome·Edge 109+, iOS Safari 15+(15.0~15.3 포함), 그 밖 브라우저는 최신 2개 버전. Chrome·Edge 109는
  `browserslist`(`package.json`)에 들어 있지 않은 **정책상 하한**이다 — 문법 변환 대상은 browserslist가 정하고, 내장
  API는 이 규칙과 폴리필이 맡는다.
- **지원하지 않는다:** Chrome·Edge 109 미만, iOS 15 미만, IE. 이 환경의 오류는 고치지 않는다. 폴리필 덕에 일부가 우연히
  동작해도 보장하지 않는다.
- 하한에 없는 메서드는 `src/shared/lib/legacyBrowserPolyfills.ts`가 `instrumentation-client.ts`에서 앱 코드보다 먼저
  채운다. 채우는 목록은 그 파일이 원본이다(e2e 삭제 목록과의 일치는 `src/__tests__/guards/legacyBrowserPolyfillParity.test.ts`).
- 그 밖에 하한보다 새 API(`Object.groupBy`·`Map.groupBy`, Set 연산 메서드, `Promise.withResolvers`, `Array.prototype.with`·
  `toSpliced`, `structuredClone` 등)는 서버 전용 코드에서만 쓴다. 클라이언트에서 필요하면 같은 파일에 명세대로
  폴리필을 추가하고, `e2e/specs/legacy-browser.spec.ts`의 삭제 목록에도 넣는다.
- `@y0ngha/siglens-core`의 브라우저 진입점은 core 쪽에서 ES2022로 막혀 있다(core `tsconfig.client.json`).

```ts
// ❌ 클라이언트 컴포넌트에서 폴리필에 없는 API
const bySector = Object.groupBy(stocks, s => s.sector);
// ✅ 서버 전용 코드로 옮기거나, 폴리필에 추가하고 e2e 삭제 목록에도 넣은 뒤 쓴다
```

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

<a id="TC-38"></a>

#### TC-38 — CloudWatch 필터 문구는 소스에 실제로 있어야 한다

`infra/aws/*.sh`의 metric filter는 `console.*` 문구를 글자 그대로 매치하므로 문구가 어긋나면 알람이 조용히 죽는다. 따옴표 용어는 ASCII여야 하고 `src`·`scripts`·`cache-handler`·설치된 core `dist`의 **문자열·템플릿 리터럴 안에** 있어야 한다(주석은 근거가 아니다). `${}` 슬롯이 만드는 문구는 슬롯 값이 소스의 따옴표 리터럴로 정확히 있고 마지막 고정 문구에 닿을 때만 인정한다. `alarmFilterPhrases.test.ts`가 이를 검사한다(소스 밖 문구는 허용 목록에 이유와 함께). `alarmFilterReachability.test.ts`는 `src`에서 그 로그가 절대 reject하지 않는 함수(`cacheNonNull` 등)의 직접 `.catch` 안에 있는 경우를 막는다.

<a id="TC-40"></a>

#### TC-40 — 실패할 수 있는 단계 앞에서 공유 상태를 바꾸는 배포 스크립트는 이전 상태를 먼저 기록하고 모든 실패 경로에서 되돌린다

공유 인프라 상태(기본 버전 포인터, 설정 값, 트래픽 대상)를 바꾼 뒤에 실패할 수 있는 단계가 오면, 바꾸기 전 값을 먼저 기록하고 변경과 결과 확정 사이의 **모든 종료 경로**(후속 단계 시작 실패, 실패·취소 결과, 타임아웃)를 나열해 각각에서 복원한다. 처음 쓴 경로만 복원하면 같은 틈이 다른 경로에서 되풀이된다. 아직 진행 중인 작업 때문에 복원이 안전하지 않은 경로(타임아웃)는 임의로 되돌리지 말고 순서가 있는 수동 조치를 출력한다.

- ❌ 새 설정 버전을 만들어 기본으로 지정한 뒤 롤아웃 시작이 실패하면 막힌 버전이 기본으로 남아, 이후 교체가 같은 실패를 반복한다.
- ✅ 지정 전에 이전 기본값을 기록하고 시작 실패·실패 결과에서 되돌린다. 타임아웃에서는 먼저 롤아웃을 취소하라는 안내를 출력한다.

<a id="TC-41"></a>

#### TC-41 — 규칙 기준선은 줄이기만 한다

`src/__tests__/guards/codeRules.baseline.json`은 `ratchet` 규칙(`non-null-assertion`, `mock-call-index`, `let-then-try`)의 파일별 위반 수를 얼려 둔 기준선이다. `codeRules.test.ts`는 수가 늘거나 새 파일에 위반이 생기면(새 파일은 0에서 시작) 실패하고, 파일이 사라졌는데 남은 항목도 실패한다. 파일이 있는데 위반이 0이 된 항목은 통과하고 줄일 수 있는 항목으로 보고된다(같은 파일을 줄이는 PR 둘이 합쳐져도 master가 깨지지 않게). `yarn rules:ratchet --tighten`을 주기적으로 돌려 줄이고 0 항목을 지운다. 파일의 이름을 바꾸거나 지웠다면(옛 경로가 사라졌을 때만) `--move <옛> <새>`로(`--tighten`보다 먼저) 항목을 따라 옮기고, 고친 파일을 새 파일로 넘기는 용도로는 거절된다. 값이 같거나 작다는 이유만으로 사라진 항목과 새 항목을 짝짓지 않는다. 도구에는 올리는 경로가 없다. 값을 올리거나 규칙 키를 더하는 것은 JSON을 손으로 고치는 일이고 사용자 승인을 PR 본문에 적어야 한다. 줄 번호가 아니라 파일별 개수만 쓴다(`TESTING.md#TE-44`).

- ❌ 새 테스트의 `mock.calls[0]`이 가드에 걸리자 기준선의 숫자를 올려 통과시킨다.
- ✅ `mock.calls.find(...)`나 `toHaveBeenCalledWith`로 고친다. `yarn rules:ratchet --against origin/master`가 올라간 값과, git 이름 변경(`-M`)으로 짝지어지지 않은 새 키를 나열한다.

<a id="TC-42"></a>

#### TC-42 — `public/` 에셋은 제자리에서 고치거나 바로 지우지 않는다

`public/` 파일은 `immutable`로 오래 캐시되고 태그 퍼지는 브라우저 캐시에 닿지 않으며, CDN·ISR에 캐시된 HTML은 배포 뒤에도 옛 경로를 요청한다. 내용이 바뀌면 버전 접미사가 붙은 새 파일명으로 만들고 모든 참조를 옮긴다. 마지막 참조를 없앤 릴리스에서는 옛 파일을 남기고 다음 릴리스에서 지운다.

- ❌ `hero-dashboard.svg`를 덮어쓰거나, 참조를 없앤 같은 릴리스에서 지운다.
- ✅ `hero-dashboard-v2.svg`를 추가하고 옛 파일은 한 릴리스 뒤에 지운다.
