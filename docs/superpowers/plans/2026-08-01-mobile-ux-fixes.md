# 모바일 [symbol] UI/UX 결함 4종 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 `[symbol]` 차트 페이지의 입력 전면 차단(P0)을 포함한 실측 확인된 UI/UX 결함 4건을 수정하고, 회귀를 자동 테스트로 고정한다.

**Architecture:** vaul 1.1.2가 `modal` prop을 내부 Radix Dialog에 전달하지 않는 업스트림 회귀를 `yarn patch`로 복구해 포커스 트랩·`aria-hidden`·`pointer-events` 부작용을 한 번에 제거한다. 헤더 팝오버는 헤더의 `relative z-40` 스택 컨텍스트를 `createPortal`로 탈출시켜 시트 위에 뜨게 한다. 나머지는 순수 프론트엔드 변경이며 데이터·스키마 변경이 없다.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, vaul 1.1.2 + @radix-ui/react-dialog, vitest + @testing-library/react, Playwright, yarn 4.12.0 (`yarn patch`)

**작업 위치:** `/Users/y0ngha/Project/siglens-mobile-ux` (워크트리, 브랜치 `fix/mobile-ux-input-and-snapshot-clarity`)

**설계 문서:** `docs/superpowers/specs/2026-08-01-mobile-ux-fixes-design.md`

---

## 사전 지식 (이 레포를 처음 보는 사람을 위해)

- **FSD 레이어 규칙**: `app → views → widgets → features → entities → shared`. 위 레이어를 import할 수 없다. 이 계획은 `views → shared`, `features/ui → shared`, `widgets → shared`만 쓰므로 위반이 없다.
- **패키지 매니저는 yarn만 사용한다.** `npm`/`pnpm` 금지.
- **Next 캐시 정리는 `yarn clear:build`.** `rm -rf .next` 직접 실행 금지.
- **주석 정책**: 이 레포는 여러 줄 JSDoc/주석 블록을 허용한다. 압축하지 말 것.
- **명령어는 반드시 package.json 스크립트를 쓴다** — 타입체크는 `yarn typecheck`(=`tsgo --noEmit`, CI와 동일), 포맷 검사는 `yarn format:check`. `npx tsc`/`npx prettier`는 CI와 다르다.
- **lint에 `--file` 플래그는 없다.** 단일 파일은 `yarn lint <path>`.
- **vitest 프로젝트가 확장자로 갈린다**: `src/**/__tests__/**/*.test.ts` → **node 환경**(DOM 없음), `*.test.tsx` → **jsdom**. DOM/훅 테스트는 반드시 `.test.tsx`.
- **커버리지는 절대 병렬로 돌리지 않는다** — `coverage/.tmp` 공유로 리포트가 깨지며 exit 0으로 위장된다.
- 각 태스크의 로컬 게이트는 **스코프 한정**(typecheck + 해당 테스트 + lint). 전체 build/E2E는 Task 11과 CI가 담당한다.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `.yarn/patches/vaul-npm-1.1.2-*.patch`, `package.json`, `yarn.lock` | vaul `modal` passthrough 복구 | 생성/수정 (yarn) |
| `src/shared/lib/__tests__/vaulPatchIntegrity.test.ts` | 패치 유실 감지 | 생성 |
| `src/views/symbol/MobileAnalysisSheet.tsx` | 죽은 `pointer-events` 핵 제거, 패치 근거 주석 | 수정 |
| `src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx` | 제거된 핵의 가드 테스트 삭제 | 수정 |
| `src/views/symbol/hooks/useMobileSheet.ts` | 시트 초기 스냅 | 수정 |
| `src/views/symbol/__tests__/hooks/useMobileSheet.test.tsx` | 초기 스냅 단언 반전 | 수정 |
| `src/views/symbol/constants/mobileSheet.ts` | 스냅 상수 주석 정합 | 수정 |
| `src/shared/ui/PopoverSurface.tsx` | 모바일에서 body로 포털되는 공유 팝오버 표면 | 생성 |
| `src/features/portfolio-holding/ui/PortfolioChipPopover.tsx` | 공유 표면 적용 | 수정 |
| `src/widgets/analysis/AnalysisSettingsMenu.tsx` | 공유 표면 적용 | 수정 |
| `src/shared/lib/formatSnapshotAsOf.ts` | 기준일 결정적 포맷 (순수 함수) | 생성 |
| `src/views/symbol/snapshot/SnapshotSummarySection.tsx` | `asOf` 배지 + 날짜 캡션 | 수정 |
| `src/views/symbol/snapshot/renderers/*.tsx` (7개) | `generatedAt` 배선, technical·overall은 상호참조 문구 | 수정 |
| `src/app/[symbol]/**` (페이지 7 + Degraded 래퍼 3) | `generatedAt` 전달 (**총 11 호출부**) | 수정 |
| `playwright.config.ts` | `authed-mobile` 프로젝트 + 라우팅 | 수정 |
| `e2e/specs/mobile-input-reachability.spec.ts` | 회원 모바일 입력 회귀 가드 | 생성 |
| `e2e/specs/mobile-analysis-sheet.spec.ts` | 비회원 모바일 입력 케이스 추가 | 수정 |

---

## Task 1: vaul `modal` passthrough 패치

**Files:**
- Create: `.yarn/patches/vaul-npm-1.1.2-<hash>.patch` (yarn이 파일명 결정)
- Modify: `package.json` (yarn이 `resolutions` 추가), `yarn.lock`

**배경:** vaul 1.1.2는 `Drawer.Root`에 `modal={false}`를 주어도 내부 `DialogPrimitive.Root`에 그 값을 넘기지 않는다. Radix 기본값 `modal=true`가 적용되어 (1) FocusScope 포커스 트랩, (2) `hideOthers`의 `aria-hidden`, (3) `disableOutsidePointerEvents`의 `body { pointer-events: none }`이 발생한다. 업스트림 미해결 이슈: <https://github.com/emilkowalski/vaul/issues/496>

- [ ] **Step 1: 패치 작업 디렉터리 생성**

```bash
cd /Users/y0ngha/Project/siglens-mobile-ux
yarn patch vaul@npm:1.1.2
```

출력의 임시 디렉터리 경로를 아래에서 `$PATCH_DIR`로 부른다. `yarn patch`는 node_modules가 아니라 yarn 캐시 zip에서 원본을 푼다 — 워크트리의 node_modules 상태와 무관하게 항상 pristine이다.

- [ ] **Step 2: ESM 빌드 수정**

`$PATCH_DIR/dist/index.mjs` 1341행 부근:

```js
    return /*#__PURE__*/ React__default.createElement(DialogPrimitive.Root, {
        defaultOpen: defaultOpen,
```

`modal: modal,`을 첫 prop으로 넣는다:

```js
    return /*#__PURE__*/ React__default.createElement(DialogPrimitive.Root, {
        modal: modal,
        defaultOpen: defaultOpen,
```

`modal`은 같은 함수 스코프에 이미 있다(`index.mjs:879`에서 `modal = true` 기본값으로 구조분해).

- [ ] **Step 3: CJS 빌드 수정**

`$PATCH_DIR/dist/index.js` 1363행 부근:

```js
    return /*#__PURE__*/ React__namespace.default.createElement(DialogPrimitive__namespace.Root, {
        defaultOpen: defaultOpen,
```

동일하게 넣는다:

```js
    return /*#__PURE__*/ React__namespace.default.createElement(DialogPrimitive__namespace.Root, {
        modal: modal,
        defaultOpen: defaultOpen,
```

> **두 빌드 모두** 고쳐야 한다. ESM만 고치면 CJS 경로에서 증상이 되살아난다.

- [ ] **Step 4: 패치 커밋(yarn)**

```bash
yarn patch-commit -s "$PATCH_DIR"
yarn install
```

- [ ] **Step 5: 패치 산출물 검증**

node_modules를 grep하지 말 것 — 이 워크트리의 node_modules는 과거 실증 과정에서 오염된 적이 있어 신뢰할 수 없다. **산출물**을 본다:

```bash
grep -c '^+.*modal: modal,' .yarn/patches/vaul-npm-1.1.2-*.patch
node -e "console.log(JSON.stringify(require('./package.json').resolutions))"
git status --porcelain package.json yarn.lock .yarn/patches
```

Expected: grep 결과 `2`(ESM+CJS), `resolutions`에 `vaul@npm:1.1.2` 키가 보이고, 세 경로 모두 변경됨으로 표시.

- [ ] **Step 6: 커밋**

`yarn.lock`을 반드시 함께 커밋한다 — CI 3개 워크플로가 모두 `yarn install --immutable`이라 lock이 어긋나면 전부 실패한다(`ci.yml:61`, `e2e.yml:74`, `deploy.yml:46`).

```bash
git add package.json yarn.lock .yarn/patches
git commit -m "fix(vaul): restore modal prop passthrough to Radix Dialog Root

vaul 1.1.2 drops the modal prop when creating DialogPrimitive.Root
(regression from PR #424, upstream issue #496), so modal={false} on our
mobile analysis sheet had no effect: Radix ran in modal mode and its
FocusScope stole focus from every input outside the sheet, hideOthers
put aria-hidden on the whole app tree, and body got pointer-events:none."
```

---

## Task 2: 패치 무결성 테스트

**Files:**
- Create: `src/shared/lib/__tests__/vaulPatchIntegrity.test.ts`

**배경:** `resolutions`는 `vaul@npm:1.1.2`에 핀된다. 의존성 버전을 올리면 해상도가 매치되지 않아 **패치가 조용히 빠지며, `yarn install`은 실패하지 않는다.** 그러면 P0 결함이 무증상으로 되돌아온다. 설치 산출물을 직접 읽어 회귀를 CI에서 막는다.

`.test.ts`(node 환경)가 맞다 — `node:fs`로 파일을 읽는 테스트라 DOM이 필요 없다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * vaul 1.1.2는 `Drawer.Root`의 `modal` prop을 내부 Radix `DialogPrimitive.Root`에
 * 전달하지 않는다(업스트림 이슈 #496). 그 결과 `modal={false}`가 무시되고 Radix가
 * modal 모드로 동작해, 모바일 분석 시트 **밖**의 모든 입력이 포커스를 빼앗긴다.
 * `.yarn/patches/vaul-npm-1.1.2-*.patch`가 passthrough를 복구한다.
 *
 * 이 테스트가 존재하는 이유: `resolutions`가 `vaul@npm:1.1.2`에 핀되어 있어
 * 버전을 올리면 패치가 **조용히** 빠지고 `yarn install`은 성공한다. 설치된
 * 산출물을 직접 읽는 것만이 유실을 잡아낸다.
 */
const require = createRequire(import.meta.url);

function readVaulBuild(specifier: string): string {
    return readFileSync(require.resolve(specifier), 'utf8');
}

describe('vaul patch integrity', () => {
    it('ESM 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('vaul/dist/index.mjs');

        expect(source).toContain('createElement(DialogPrimitive.Root, {');
        expect(source).toMatch(
            /createElement\(DialogPrimitive\.Root,\s*\{\s*modal: modal,/
        );
    });

    it('CJS 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('vaul/dist/index.js');

        expect(source).toMatch(
            /createElement\(DialogPrimitive__namespace\.Root,\s*\{\s*modal: modal,/
        );
    });
});
```

- [ ] **Step 2: 테스트 실행 (Task 1 이후이므로 PASS해야 정상)**

```bash
yarn vitest run src/shared/lib/__tests__/vaulPatchIntegrity.test.ts
```

Expected: 2 tests PASS. **FAIL이면 Task 1의 패치가 제대로 적용되지 않은 것이다** — Task 1 Step 5로 돌아간다.

- [ ] **Step 3: 가드가 실제로 작동하는지 확인 (역방향 검증)**

패치가 빠졌을 때 정말 빨간불이 켜지는지 1회 확인한다:

```bash
cp node_modules/vaul/dist/index.mjs /tmp/vaul-index.mjs.bak
node -e "const f='node_modules/vaul/dist/index.mjs';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('modal: modal,\n        defaultOpen','defaultOpen'))"
yarn vitest run src/shared/lib/__tests__/vaulPatchIntegrity.test.ts
cp /tmp/vaul-index.mjs.bak node_modules/vaul/dist/index.mjs
yarn vitest run src/shared/lib/__tests__/vaulPatchIntegrity.test.ts
```

Expected: 중간 실행이 FAIL, 복원 후 실행이 PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/shared/lib/__tests__/vaulPatchIntegrity.test.ts
git commit -m "test(vaul): fail loudly if the modal passthrough patch goes missing

resolutions pins the patch to vaul@npm:1.1.2, so a version bump drops it
without failing yarn install. Reading the installed build is the only
thing that catches it."
```

---

## Task 3: 죽은 `pointer-events` 복구 핵 제거

**Files:**
- Modify: `src/views/symbol/MobileAnalysisSheet.tsx`
- Modify: `src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx` (**이미 존재하는 195행 파일**)

**배경:** Task 1로 `modal={false}`가 Radix까지 도달하면 Radix는 `body`의 `pointer-events`를 건드리지 않는다. 기존 `useRestoreBodyPointerEvents`는 죽은 코드가 되며, 남겨두면 다음 사람이 근본 원인을 오독한다.

- [ ] **Step 1: 핵을 고정하던 기존 테스트 삭제**

`src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx`의 **145~194행** — 주석 3줄과 `describe('body pointer-events repair', …)` 블록 전체 — 를 삭제한다. 이 블록은 지금 제거하려는 훅을 지키려고 존재하며, 훅이 사라지면 3개 중 2개가 실패한다.

삭제 시작점(주석 포함):

```tsx
    // vaul 1.1.2 leaks `pointer-events: none` onto <body> even with modal={false},
```

삭제 끝점: 그 `describe` 블록의 닫는 `});` (파일 최상위 `describe`의 닫는 `});` 바로 위).

삭제 후 더 이상 쓰이지 않는 import가 있으면 함께 정리한다(`waitFor`가 이 블록에서만 쓰였다면 제거 — lint가 잡아준다).

- [ ] **Step 2: 새 가드 테스트 추가**

같은 파일 최상위 `describe` **안**에, 방금 지운 자리에 아래 `it` 하나만 추가한다. **import 문을 새로 넣지 말 것** — `render`/`screen`/`MobileAnalysisSheet`은 파일 상단에 이미 있고, `describe/it/expect/vi`는 `globals: true`로 전역이다.

```tsx
    // Task 1의 vaul 패치로 Radix가 non-modal로 동작하므로 body pointer-events를
    // 되돌릴 필요가 없어졌다. 훅이 되살아나면(= 근본 원인을 다시 땜질하면)
    // 이 단언이 깨진다.
    it('body를 감시하는 MutationObserver를 설치하지 않는다', () => {
        const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

        render(
            <MobileAnalysisSheet
                activeSnap={SNAP_HALF}
                onActiveSnapChange={vi.fn()}
            >
                <span>content</span>
            </MobileAnalysisSheet>
        );

        const bodyObservations = observeSpy.mock.calls.filter(
            ([target]) => target === document.body
        );
        expect(bodyObservations).toHaveLength(0);

        observeSpy.mockRestore();
    });
```

> 이 파일은 `vi.mock('vaul', …)`과 `useMobileAnalysisSheet` 목으로 `isOpen: true`를 강제해야만 렌더된다. 파일 상단에 이미 그 설정이 있으므로 그대로 쓴다. 새 파일을 만들면 안 된다.

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx
```

Expected: 새 `MutationObserver` 테스트가 FAIL(현재 코드가 `document.body`를 observe 한다). 나머지는 PASS.

- [ ] **Step 4: 핵 제거**

`src/views/symbol/MobileAnalysisSheet.tsx`에서 삭제:
- `POINTER_EVENTS_NONE` / `POINTER_EVENTS_AUTO` 상수 (10~11행)
- `useRestoreBodyPointerEvents` 함수와 그 위 JSDoc (13~41행)
- 본문의 `useRestoreBodyPointerEvents();` 호출 (69행)
- 3행 import에서 `useEffect`만 제거 (`type ReactNode`는 유지)

`MobileAnalysisSheet` 함수 선언 바로 위에 근거 주석을 추가한다:

```tsx
/**
 * 모바일 분석 바텀시트.
 *
 * `modal={false}`는 반드시 Radix Dialog까지 도달해야 한다. vaul 1.1.2는 이 prop을
 * 내부 `DialogPrimitive.Root`에 전달하지 않는 회귀가 있어(업스트림 이슈 #496,
 * PR #424에서 유입), Radix가 modal 모드로 동작하면 FocusScope가 시트 밖 입력의
 * 포커스를 빼앗고(평단 팝오버·헤더 검색·챗봇 입력이 모두 먹통), `hideOthers`가 앱
 * 트리 전체에 `aria-hidden`을 붙이며, `body`에 `pointer-events: none`이 적용된다.
 *
 * 그래서 `.yarn/patches/vaul-npm-1.1.2-*.patch`로 passthrough를 복구했고,
 * `src/shared/lib/__tests__/vaulPatchIntegrity.test.ts`가 패치 유실을 감시한다.
 * 패치 덕분에 예전의 body pointer-events 복구용 MutationObserver 핵은 제거했다.
 */
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
yarn vitest run src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx
yarn typecheck
```

Expected: 전부 PASS, 타입 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/views/symbol/MobileAnalysisSheet.tsx src/views/symbol/__tests__/MobileAnalysisSheet.test.tsx
git commit -m "refactor(symbol): drop dead body pointer-events restore hack

The vaul patch makes Radix run non-modal, so it no longer sets
pointer-events on body. The MutationObserver workaround is now dead code
that would mislead the next reader about the real root cause."
```

---

## Task 4: 시트 초기 스냅을 PEEK으로 정합

**Files:**
- Modify: `src/views/symbol/hooks/useMobileSheet.ts`
- Modify: `src/views/symbol/__tests__/hooks/useMobileSheet.test.tsx` (**이미 존재**)
- Modify: `src/views/symbol/constants/mobileSheet.ts`
- Modify: `src/views/symbol/__tests__/SymbolPageClient.test.tsx` (목값 정합)

**배경:** 초기 스냅이 `SNAP_HALF`(0.55)인데 `ChartContent`는 `SNAP_PEEK`(0.15) 높이만큼만 하단 패딩을 예약한다. 3개 기기 실측 결과 차트를 가리지 않는 최대 시트 비율은 0.194~0.215이므로 HALF는 차트를 덮고 PEEK은 덮지 않는다. `SNAP_HALF`의 원래 목적("분석 중 배너 노출")도 PEEK에서 충족된다 — 배너 높이 36px, PEEK 가시 영역 85px(iPhone SE)~126px(Pixel 7).

- [ ] **Step 1: 기존 단언을 반전**

`src/views/symbol/__tests__/hooks/useMobileSheet.test.tsx`의 6~9행을 교체한다(새 파일을 만들지 말 것 — 이 경로가 레포 컨벤션이다):

```tsx
    it('초기 스냅은 SNAP_PEEK이다 — ChartContent의 --snap-peek 패딩 예약과 정합을 맞춰 차트를 가리지 않는다', () => {
        const { result } = renderHook(() => useMobileSheet());
        expect(result.current.sheetSnap).toBe(SNAP_PEEK);
    });
```

3행 import에서 더 이상 쓰이지 않는 `SNAP_HALF`를 뺀다:

```tsx
import { SNAP_PEEK } from '@/views/symbol/constants/mobileSheet';
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/views/symbol/__tests__/hooks/useMobileSheet.test.tsx
```

Expected: FAIL — `expected 0.55 to be 0.15`.

- [ ] **Step 3: 구현**

`src/views/symbol/hooks/useMobileSheet.ts` — import(9행)와 초기 상태(20행):

```ts
import { SNAP_PEEK, type SnapPoint } from '../constants/mobileSheet';
```

```ts
    // 초기 스냅은 PEEK이다. HALF로 열면 캔들·거래량 차트를 덮는데(3개 기기 실측:
    // 차트를 가리지 않는 최대 시트 비율 0.194~0.215), ChartContent는 하단 패딩을
    // SNAP_PEEK 높이만큼만 예약하므로 정합도 깨진다. PEEK에서도 "AI 분석 중" 배너
    // (36px)는 가시 영역(85~126px) 안에 들어오므로 HALF의 원래 목적은 유지된다.
    const [sheetSnap, setSheetSnap] = useState<SnapPoint>(SNAP_PEEK);
```

- [ ] **Step 4: 상수 주석 정합**

`src/views/symbol/constants/mobileSheet.ts` 3~5행:

```ts
export const SNAP_PEEK = 0.15; // 15% — 기본(초기) 접힘. 차트를 가리지 않는 최대치 아래
export const SNAP_HALF = 0.55; // 55% — 드래그 중간 스냅
export const SNAP_FULL = 0.97; // 97% — 전체 열림
```

- [ ] **Step 5: 목값 정합**

`src/views/symbol/__tests__/SymbolPageClient.test.tsx`에서 `sheetSnap: 0.55`를 `sheetSnap: 0.15`로 바꾼다. 동작에는 영향이 없으나 초기값을 잘못 알려주는 목은 다음 사람을 오도한다.

- [ ] **Step 6: 테스트 통과 확인**

```bash
yarn vitest run src/views/symbol
yarn typecheck
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/views/symbol/hooks/useMobileSheet.ts src/views/symbol/constants/mobileSheet.ts "src/views/symbol/__tests__"
git commit -m "fix(symbol): open the mobile analysis sheet at PEEK, not HALF

HALF covered both charts on every measured device (max non-covering
ratio 0.194-0.215) and contradicted ChartContent, which only reserves
bottom padding for PEEK. The analysis banner still fits at PEEK."
```

---

## Task 5: 공유 팝오버 표면 (모바일 포털)

**Files:**
- Create: `src/shared/ui/PopoverSurface.tsx`
- Test: `src/shared/ui/__tests__/PopoverSurface.test.tsx`

**배경 (왜 CSS만으로 안 되는가):** `SymbolLayoutHeader.tsx:50`의 `<header className="relative z-40">`은 **스택 컨텍스트를 생성**한다. 그래서 헤더 자손인 팝오버는 `z-[60]`을 줘도 루트 컨텍스트에서는 40레벨로 합성되고, `document.body`에 포털된 시트(`z-50`)에 덮인다. **`createPortal`로 헤더 밖에 렌더해야만** z-60이 유효해진다.

실측(로그인, 초기 스냅 HALF)에서 평단 팝오버와 분석 설정 메뉴가 **둘 다** 시트에 덮였고, 평단은 가로로도 넘쳤다(iPhone SE x=−88, iPhone 14 x=−18). 그래서 일회성 수정이 아니라 공유 표면으로 만든다.

레포에 이미 같은 패턴이 있다 — `src/widgets/chart/ui/IndicatorSettingsModal.tsx:121-123`의 `createPortal(…, document.body)` + `fixed inset-0 z-60 flex items-center justify-center p-4`. 이것을 따른다. `z-60`은 이 레포에서 이미 쓰는 Tailwind v4 유틸이다(`FloatingChatButton.tsx:24,29,47`). **`z-[60]` 같은 임의값은 이 레포에 없으므로 쓰지 않는다.**

- [ ] **Step 1: 실패하는 테스트 작성**

`src/shared/ui/__tests__/PopoverSurface.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PopoverSurface } from '../PopoverSurface';

function mockViewport(isMobile: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: isMobile,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PopoverSurface', () => {
    it('데스크탑에서는 제자리에 앵커드 팝오버로 렌더한다', () => {
        mockViewport(false);

        render(
            <div data-testid="anchor">
                <PopoverSurface>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        const anchor = screen.getByTestId('anchor');
        expect(anchor).toContainElement(screen.getByText('내용'));
        expect(
            document.querySelector('[data-testid="popover-backdrop"]')
        ).toBeNull();
    });

    it('모바일에서는 body로 포털하고 배경을 깐다 — 헤더의 z-40 스택 컨텍스트를 탈출해야 시트 위에 뜬다', () => {
        mockViewport(true);

        render(
            <div data-testid="anchor">
                <PopoverSurface>
                    <p>내용</p>
                </PopoverSurface>
            </div>
        );

        const anchor = screen.getByTestId('anchor');
        expect(anchor).not.toContainElement(screen.getByText('내용'));
        expect(
            document.querySelector('[data-testid="popover-backdrop"]')
        ).not.toBeNull();
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/shared/ui/__tests__/PopoverSurface.test.tsx
```

Expected: FAIL — `Cannot find module '../PopoverSurface'`.

- [ ] **Step 3: 구현**

`src/shared/ui/PopoverSurface.tsx`:

```tsx
'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';

/**
 * 헤더 앵커드 팝오버를 모바일에서 화면 중앙 모달로 승격시키는 공유 표면.
 *
 * 왜 포털이 필요한가: `SymbolLayoutHeader`가 `relative z-40`이라 **스택 컨텍스트를
 * 생성**한다. 그 안의 팝오버는 z-index를 아무리 올려도 루트 컨텍스트에서는 40레벨로
 * 합성되므로, `document.body`에 포털된 분석 시트(z-50)에 덮인다. 실측에서 평단
 * 팝오버와 분석 설정 메뉴가 둘 다 시트에 가려졌다. body로 포털해야 z-60이 유효하다.
 *
 * 가로 오버플로우도 같이 해결된다 — 앵커(칩) 기준 `right-0` 정렬이 좁은 화면에서
 * 왼쪽으로 넘치던 문제(iPhone SE에서 x=−88px)가, 뷰포트 중앙 정렬로 원천 차단된다.
 *
 * 데스크탑에서는 아무것도 하지 않고 children을 제자리에 렌더한다.
 */
interface PopoverSurfaceProps {
    children: ReactNode;
}

export function PopoverSurface({ children }: PopoverSurfaceProps) {
    const isMobileViewport = useIsMobileViewport();

    if (!isMobileViewport) return <>{children}</>;

    return createPortal(
        <div
            data-testid="popover-backdrop"
            className="bg-secondary-950/80 fixed inset-0 z-60 flex items-center justify-center overscroll-contain p-4 backdrop-blur-sm"
        >
            {children}
        </div>,
        document.body
    );
}

/** 모바일(포털) 경로에서 패널이 쓰는 배치 클래스. 뷰포트 중앙, 화면 밖으로 나갈 수 없다. */
export const POPOVER_PANEL_MOBILE = 'w-full max-w-sm';

/** 데스크탑에서 트리거에 앵커되는 기존 배치 클래스. */
export const POPOVER_PANEL_DESKTOP =
    'absolute top-full right-0 z-50 w-72 max-w-[calc(100vw-2rem)]';
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/shared/ui/__tests__/PopoverSurface.test.tsx
yarn typecheck
yarn lint src/shared/ui/PopoverSurface.tsx
```

Expected: 2 tests PASS, 타입/lint 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/shared/ui/PopoverSurface.tsx src/shared/ui/__tests__/PopoverSurface.test.tsx
git commit -m "feat(shared): add PopoverSurface that portals header popovers on mobile

The symbol header is relative z-40, which creates a stacking context, so
a popover inside it can never paint above the body-portaled analysis
sheet at z-50 no matter what z-index it declares. Portaling to body is
the only fix, and it removes the horizontal overflow at the same time."
```

---

## Task 6: 평단 팝오버에 공유 표면 적용

**Files:**
- Modify: `src/features/portfolio-holding/ui/PortfolioChipPopover.tsx`
- Test: `src/features/portfolio-holding/__tests__/PortfolioChipPopover.test.tsx` (없으면 생성)

- [ ] **Step 1: 실패하는 테스트 작성**

파일이 이미 있으면 `describe` 블록만 추가하고, 없으면 아래 전체로 새로 만든다.

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { PortfolioChipPopover } from '../ui/PortfolioChipPopover';

function mockViewport(isMobile: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: isMobile,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

function renderPopover() {
    const triggerRef = createRef<HTMLButtonElement>();
    return render(
        <div data-testid="anchor">
            <PortfolioChipPopover
                symbol="AAPL"
                holding={null}
                save={
                    {
                        isPending: false,
                        mutateAsync: vi.fn(),
                    } as unknown as Parameters<
                        typeof PortfolioChipPopover
                    >[0]['save']
                }
                triggerRef={triggerRef}
                onClose={vi.fn()}
            />
        </div>
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PortfolioChipPopover — 뷰포트 안전 배치', () => {
    it('모바일에서는 body로 포털되어 헤더 스택 컨텍스트를 탈출한다', () => {
        mockViewport(true);
        renderPopover();

        const anchor = screen.getByTestId('anchor');
        const dialog = screen.getByRole('dialog');
        expect(anchor).not.toContainElement(dialog);
    });

    it('데스크탑에서는 트리거에 앵커된 팝오버를 유지한다', () => {
        mockViewport(false);
        renderPopover();

        const anchor = screen.getByTestId('anchor');
        const dialog = screen.getByRole('dialog');
        expect(anchor).toContainElement(dialog);
        expect(dialog.className).toContain('absolute');
        expect(dialog.className).toContain('right-0');
    });

    it('두 경로 모두 수량·평단 입력을 렌더한다', () => {
        mockViewport(true);
        renderPopover();

        expect(screen.getByLabelText('수량')).toBeInTheDocument();
        expect(screen.getByLabelText('평단')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/features/portfolio-holding/__tests__/PortfolioChipPopover.test.tsx
```

Expected: 모바일 포털 테스트 FAIL (현재는 항상 제자리 렌더).

- [ ] **Step 3: 구현**

import에 공유 표면을 추가한다:

```tsx
import {
    POPOVER_PANEL_DESKTOP,
    POPOVER_PANEL_MOBILE,
    PopoverSurface,
} from '@/shared/ui/PopoverSurface';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
```

컴포넌트 본문에서 `useFocusTrap` 호출들 아래에 뷰포트 플래그를 읽는다:

```tsx
    const isMobileViewport = useIsMobileViewport();
```

`return (` 이하의 최상위 `<div ref={panelRef} …>`를 `PopoverSurface`로 감싸고 className만 갈아끼운다. **`<h2>`부터 `</form>`까지 내부는 한 글자도 바꾸지 않는다.**

```tsx
    return (
        <PopoverSurface>
            <div
                ref={panelRef}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    isMobileViewport
                        ? POPOVER_PANEL_MOBILE
                        : `${POPOVER_PANEL_DESKTOP} mt-2`,
                    'border-secondary-700 bg-secondary-900',
                    'overscroll-contain rounded-lg border p-4 shadow-2xl outline-none',
                    'motion-safe:animate-[fade-in_150ms_ease-out]'
                )}
            >
                {/* …기존 <h2>와 <form> 전체를 그대로 유지, 들여쓰기만 한 단계 증가… */}
            </div>
        </PopoverSurface>
    );
```

> 배경(`PopoverSurface`가 렌더)은 `panelRef`/`triggerRef` 밖이므로 기존 `useOnClickOutside`(document `pointerdown`)가 그대로 닫기를 처리한다. 새 핸들러가 필요 없다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/features/portfolio-holding
yarn typecheck
yarn lint src/features/portfolio-holding/ui/PortfolioChipPopover.tsx
```

Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/features/portfolio-holding
git commit -m "fix(portfolio): keep the holding popover on screen and above the sheet

Anchored right-0 to the chip, the 288px panel overflowed past the left
viewport edge (x=-88 on iPhone SE) and, being inside the header's z-40
stacking context, was painted under the analysis sheet."
```

---

## Task 7: 분석 설정 메뉴에 공유 표면 적용

**Files:**
- Modify: `src/widgets/analysis/AnalysisSettingsMenu.tsx`
- Test: `src/widgets/analysis/__tests__/AnalysisSettingsMenu.test.tsx` (없으면 생성)

**배경:** 실측에서 이 메뉴도 시트에 덮였다(iPhone SE bottom 341 > sheetTop 273, iPhone 14 bottom 335 > sheetTop 319). 가로 넘침은 없지만 가려짐은 평단 팝오버와 동일한 원인(헤더 z-40 스택 컨텍스트)이다.

- [ ] **Step 1: 실패하는 테스트 작성**

기존 테스트 파일이 있으면 `describe`만 추가한다. 이 컴포넌트는 props가 많으므로, 파일이 이미 있으면 **거기서 쓰는 렌더 헬퍼를 재사용**한다. 없으면:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisSettingsMenu } from '../AnalysisSettingsMenu';

function mockViewport(isMobile: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: isMobile,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

function renderMenu() {
    return render(
        <div data-testid="anchor">
            <AnalysisSettingsMenu
                modelId="deepseek-v4-flash"
                handleModelChange={vi.fn()}
                allowedModels={['deepseek-v4-flash']}
                reasoning={false}
                setReasoning={vi.fn()}
                canUseReasoning={false}
                openSignupNudge={vi.fn()}
            />
        </div>
    );
}

describe('AnalysisSettingsMenu — 뷰포트 안전 배치', () => {
    it('모바일에서 메뉴를 열면 body로 포털되어 분석 시트에 가려지지 않는다', async () => {
        mockViewport(true);
        renderMenu();

        await screen.getByRole('button', { name: /분석 설정/ }).click();

        const anchor = screen.getByTestId('anchor');
        expect(anchor).not.toContainElement(screen.getByRole('dialog'));
    });

    it('데스크탑에서는 트리거에 앵커된 팝오버를 유지한다', async () => {
        mockViewport(false);
        renderMenu();

        await screen.getByRole('button', { name: /분석 설정/ }).click();

        const anchor = screen.getByTestId('anchor');
        expect(anchor).toContainElement(screen.getByRole('dialog'));
    });
});
```

> 위 props 값은 실제 시그니처와 다를 수 있다. **파일을 열어 `AnalysisSettingsMenuProps`를 보고 맞춘다.** `modelId`의 기본값은 `DEEPSEEK_V4_FLASH_MODEL` 상수를 import해서 쓰는 편이 안전하다. 기존 테스트 파일이 있으면 그 렌더 헬퍼를 그대로 재사용하는 것이 가장 안전하다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/widgets/analysis
```

Expected: 모바일 포털 테스트 FAIL.

- [ ] **Step 3: 구현**

`PopoverSurface`와 `useIsMobileViewport`를 import하고, `{isOpen && (…)}` 안의 패널을 감싼다. 기존 className에서 배치 관련(`absolute top-full right-0 z-50 mt-1 w-72 max-w-[calc(100vw-2rem)]`)만 분기하고 나머지 시각 클래스는 유지한다:

```tsx
            {isOpen && (
                <PopoverSurface>
                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        className={cn(
                            isMobileViewport
                                ? POPOVER_PANEL_MOBILE
                                : `${POPOVER_PANEL_DESKTOP} mt-1`,
                            'border-secondary-700 bg-secondary-900 flex flex-col gap-3',
                            'overscroll-contain rounded-lg border p-3 shadow-2xl outline-none'
                        )}
                    >
                        {/* …기존 자식 전부 그대로… */}
                    </div>
                </PopoverSurface>
            )}
```

`cn`이 이미 import되어 있지 않으면 추가한다(`@/shared/lib/cn`).

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/widgets/analysis
yarn typecheck
yarn lint src/widgets/analysis/AnalysisSettingsMenu.tsx
```

Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/analysis
git commit -m "fix(analysis): portal the settings menu on mobile so the sheet cannot cover it

Measured on iPhone SE and iPhone 14: the panel's bottom edge fell below
the sheet's top edge, and the header's z-40 stacking context made its
own z-50 useless against the body-portaled sheet."
```

---

## Task 8: 스냅샷 기준일 포맷 순수 함수

**Files:**
- Create: `src/shared/lib/formatSnapshotAsOf.ts`
- Test: `src/shared/lib/__tests__/formatSnapshotAsOf.test.ts`

**배경:** 캡션이 `전일 장마감 기준` 고정 문자열인데, 읽기 경로는 최대 `SNAPSHOT_MAX_AGE_MS`(7일) 된 행까지 허용한다(`src/entities/seo-snapshot/model.ts:25`). 실제 `generatedAt` 날짜를 표기하면 며칠 된 스냅샷에서도 항상 참이 된다.

**결정성:** 금지된 것은 렌더 중 `new Date()`다. `generatedAt`은 DB 행 값이므로 같은 캐시 엔트리에서 항상 같은 문자열을 만든다. 서버 로케일·TZ 의존을 없애려 `Intl.DateTimeFormat`에 로케일과 `timeZone`을 명시 고정한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/shared/lib/__tests__/formatSnapshotAsOf.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatSnapshotAsOf } from '../formatSnapshotAsOf';

describe('formatSnapshotAsOf', () => {
    it('미국 동부 기준 날짜를 한국어로 포맷한다', () => {
        // 2026-07-31T20:00:00Z = 2026-07-31 16:00 America/New_York (EDT, 장마감)
        expect(formatSnapshotAsOf(new Date('2026-07-31T20:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('UTC 자정을 넘었어도 동부 기준 날짜를 쓴다', () => {
        // 2026-08-01T01:00:00Z = 2026-07-31 21:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T01:00:00Z'))).toBe(
            '2026년 7월 31일'
        );
    });

    it('월 경계를 올바르게 넘긴다', () => {
        // 2026-08-01T13:00:00Z = 2026-08-01 09:00 America/New_York
        expect(formatSnapshotAsOf(new Date('2026-08-01T13:00:00Z'))).toBe(
            '2026년 8월 1일'
        );
    });

    it('같은 입력에 항상 같은 출력을 낸다 (ISR 캐시 결정성)', () => {
        const date = new Date('2026-07-31T20:00:00Z');
        expect(formatSnapshotAsOf(date)).toBe(formatSnapshotAsOf(date));
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/shared/lib/__tests__/formatSnapshotAsOf.test.ts
```

Expected: FAIL — `Cannot find module '../formatSnapshotAsOf'`.

- [ ] **Step 3: 구현**

`src/shared/lib/formatSnapshotAsOf.ts`:

```ts
/**
 * 스냅샷 프로즈의 "기준일" 캡션용 포맷터.
 *
 * 로케일과 타임존을 명시 고정한다 — 서버 환경의 기본 로케일/TZ에 의존하면 같은
 * 스냅샷이 환경에 따라 다른 문자열로 렌더되어 ISR 캐시 엔트리 간 출력이 흔들린다.
 * 미국 장마감 기준이므로 타임존은 America/New_York을 쓴다(EST/EDT 자동 처리).
 *
 * 입력은 DB 행의 `generatedAt`이어야 한다. 렌더 중 `new Date()`를 넣으면 재검증
 * 시점마다 값이 바뀌어 결정적 출력 원칙이 깨진다.
 */
const SNAPSHOT_AS_OF_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

export function formatSnapshotAsOf(date: Date): string {
    return SNAPSHOT_AS_OF_FORMATTER.format(date);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/shared/lib/__tests__/formatSnapshotAsOf.test.ts
```

Expected: 4 tests PASS. (Node v25 full-ICU에서 위 3개 기대값이 실측 확인됨.)

- [ ] **Step 5: 커밋**

```bash
git add src/shared/lib/formatSnapshotAsOf.ts src/shared/lib/__tests__/formatSnapshotAsOf.test.ts
git commit -m "feat(shared): add deterministic snapshot as-of date formatter"
```

---

## Task 9: 스냅샷 셸에 기준일·배지 노출

**Files:**
- Modify: `src/views/symbol/snapshot/SnapshotSummarySection.tsx`
- Test: `src/views/symbol/snapshot/__tests__/SnapshotSummarySection.test.tsx`

**배경:** 프로덕션 실측에서 AAPL이 -7.35% 급락한 날, 전일 프로즈는 "분석 시점 가격 333.43달러 / RSI 61.66 과매수"라고 서술한 반면 라이브 요약은 "$308.91 / RSI 43.2 중립"이었다. 제목이 유사하고 기준일이 없어 틀린 정보로 읽힌다.

배지 문구는 `지난 AI 분석`이다. `전일`은 7일 된 스냅샷에서 거짓이 되므로 쓰지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

기존 파일에 `describe`를 **추가**한다(기존 테스트는 그대로 둔다).

```tsx
describe('SnapshotSummarySection — 기준일 표기', () => {
    it('asOf가 있으면 "지난 AI 분석" 배지와 실제 기준일 캡션을 렌더한다', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                asOf={new Date('2026-07-31T20:00:00Z')}
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText('지난 AI 분석')).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });

    it('asOf가 있으면 "전일" 고정 문구를 쓰지 않는다 — 7일 된 스냅샷에서 거짓이 되기 때문', () => {
        render(
            <SnapshotSummarySection
                displayName="Apple Inc."
                asOf={new Date('2026-07-31T20:00:00Z')}
            >
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.queryByText(/전일 장마감 기준/)).not.toBeInTheDocument();
    });

    it('asOf가 없으면 기존 캡션으로 폴백한다', () => {
        render(
            <SnapshotSummarySection displayName="Apple Inc.">
                <p>본문</p>
            </SnapshotSummarySection>
        );

        expect(screen.getByText(/전일 장마감 기준/)).toBeInTheDocument();
        expect(screen.queryByText('지난 AI 분석')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/views/symbol/snapshot/__tests__/SnapshotSummarySection.test.tsx
```

Expected: 새 `describe`에서 FAIL.

- [ ] **Step 3: 구현**

변경은 세 곳뿐이다. **기존 "audit fix FIX 5" 주석 블록은 건드리지 않는다.**

(a) import에 포맷터 추가:

```tsx
import { formatSnapshotAsOf } from '@/shared/lib/formatSnapshotAsOf';
```

(b) props 인터페이스에 `asOf` 추가:

```tsx
    /**
     * 스냅샷 행의 `generatedAt`. 주어지면 캡션에 실제 기준일을 찍고 "지난 AI 분석"
     * 배지를 붙여 라이브 분석 카드와 구분한다. 읽기 경로가 최대 7일 된 행까지
     * 허용하므로(`SNAPSHOT_MAX_AGE_MS`), 실제 날짜가 "전일" 고정 문구보다 정확하다.
     */
    asOf?: Date;
```

(c) 시그니처에 `asOf,`를 넣고, `headingId` 아래에 캡션을 계산한 뒤, `<h2>`를 flex 래퍼로 감싸고 배지를 조건부로 붙이고, 캡션 `<p>`를 변수로 교체한다:

```tsx
    const headingId = useId();
    const caption =
        asOf === undefined
            ? `${displayName} · 전일 장마감 기준`
            : `${displayName} · ${formatSnapshotAsOf(asOf)} 미국 장마감 기준`;
```

기존 `<h2 id={headingId} …>{title}</h2>` 를 아래로 교체한다(그 위의 주석 블록은 그대로 둔다):

```tsx
                <div className="flex flex-wrap items-center gap-2">
                    <h2
                        id={headingId}
                        className="text-secondary-100 text-lg font-semibold tracking-tight"
                    >
                        {title}
                    </h2>
                    {asOf !== undefined && (
                        // 라이브 분석 카드와 한눈에 구분되도록 배지를 단다.
                        // "전일"은 최대 7일 된 스냅샷에서 거짓이 되므로 쓰지 않는다.
                        <span className="border-secondary-600 text-secondary-300 bg-secondary-900/60 rounded-full border px-2 py-0.5 text-xs font-medium">
                            지난 AI 분석
                        </span>
                    )}
                </div>
```

기존 캡션 `<p>`를 교체한다:

```tsx
                <p className="text-secondary-400 text-xs">{caption}</p>
```

(d) 파일 상단 JSDoc의 마지막 문단("전일 장마감 기준" 캡션은 고정 라벨이다…)을 교체한다:

```
 * 캡션은 `asOf`(스냅샷 행의 `generatedAt`)가 주어지면 실제 기준일을 찍고, 없으면
 * 기존 "전일 장마감 기준" 문구로 폴백한다. 어느 쪽이든 렌더에서 `new Date()`를
 * 쓰지 않으므로 결정적 출력이 유지된다(cold-gen dynamic API 회피).
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/views/symbol/snapshot/__tests__/SnapshotSummarySection.test.tsx
yarn typecheck
```

Expected: 기존 포함 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/views/symbol/snapshot/SnapshotSummarySection.tsx src/views/symbol/snapshot/__tests__/SnapshotSummarySection.test.tsx
git commit -m "feat(snapshot): show the real as-of date and a past-analysis badge

The card sat next to the live analysis with a near-identical heading and
no date, so on a volatile day its prose read as current data. The read
path accepts rows up to 7 days old, so a concrete date is also more
truthful than the fixed 전일 wording."
```

---

## Task 10: 7개 렌더러에 `generatedAt` 배선 + 상호참조 문구

**Files:**
- Modify: `src/views/symbol/snapshot/renderers/TechnicalSnapshotProse.tsx`
- Modify: `src/views/symbol/snapshot/renderers/OverallSnapshotProse.tsx`
- Modify: `FundamentalSnapshotProse.tsx`, `FinancialsSnapshotProse.tsx`, `CongressSnapshotProse.tsx`, `OptionsSnapshotProse.tsx`, `NewsSnapshotProse.tsx`
- Test: `src/views/symbol/snapshot/__tests__/TechnicalSnapshotProse.test.tsx`

7개 모두 `interface *SnapshotProseProps { content: unknown; symbol: string; displayName: string }` + 단일 `<SnapshotSummarySection>` 호출이라는 동일 구조다.

- [ ] **Step 1: 실패하는 테스트 작성**

`TechnicalSnapshotProse.test.tsx`에 `describe`를 추가한다. 이 파일의 픽스처는 **함수** `buildFixture()`다(변수가 아니다).

```tsx
describe('TechnicalSnapshotProse — 라이브 분석과의 구분', () => {
    it('generatedAt을 셸의 기준일 캡션·배지로 전달한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                generatedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
        expect(screen.getByText('지난 AI 분석')).toBeInTheDocument();
    });

    it('실시간 분석이 따로 있음을 알리는 안내 문구를 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
                generatedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(
            screen.getByText(
                '실시간 AI 분석 결과는 분석 패널에서 따로 제공됩니다.'
            )
        ).toBeInTheDocument();
    });

    it('generatedAt이 없어도 종전대로 렌더한다', () => {
        render(
            <TechnicalSnapshotProse
                content={buildFixture()}
                symbol="AAPL"
                displayName="Apple Inc."
            />
        );

        expect(
            screen.getByRole('heading', { name: '기술적 분석 요약' })
        ).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
yarn vitest run src/views/symbol/snapshot/__tests__/TechnicalSnapshotProse.test.tsx
```

Expected: FAIL — `generatedAt` prop 없음, 안내 문구 없음.

- [ ] **Step 3: 기술 렌더러 구현**

props 인터페이스에 추가:

```tsx
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
```

구조분해에 `generatedAt,` 추가. `<SnapshotSummarySection>`에 `asOf={generatedAt}` 추가. 그리고 children 최상단(`<div className="text-secondary-300 space-y-4 text-sm leading-6">` 바로 안)에 안내 문구를 넣는다:

```tsx
        <SnapshotSummarySection
            title="기술적 분석 요약"
            displayName={displayName}
            asOf={generatedAt}
        >
            <div className="text-secondary-300 space-y-4 text-sm leading-6">
                {/*
                 * 이 탭은 라이브 AI 분석 패널과 이 과거 스냅샷이 같은 화면에 놓인다.
                 * 급변동일에는 두 값이 크게 어긋나므로(관측: 라이브 $308.91/RSI 43.2
                 * vs 스냅샷 $333.43/RSI 61.66), 어느 쪽이 실시간인지 본문에서도 한 번
                 * 더 못박는다.
                 */}
                <p className="text-secondary-400 text-xs">
                    실시간 AI 분석 결과는 분석 패널에서 따로 제공됩니다.
                </p>
                <div className="space-y-2">
```

- [ ] **Step 4: 종합(overall) 렌더러 구현**

`OverallSnapshotProse.tsx`도 라이브 분석 패널이 같은 화면에 있으므로 **동일하게** `generatedAt` prop + `asOf` + 안내 문구를 넣는다. 안내 문구는 children 최상단에 같은 마크업으로 넣는다.

- [ ] **Step 5: 나머지 5개 렌더러 배선**

`FundamentalSnapshotProse`, `FinancialsSnapshotProse`, `CongressSnapshotProse`, `OptionsSnapshotProse`, `NewsSnapshotProse`에는 **3가지만** 적용한다. 안내 문구는 넣지 않는다 — 이 탭들에는 가리킬 라이브 분석 패널이 없다.

1. props 인터페이스에 `generatedAt?: Date;` (위와 같은 JSDoc 포함)
2. 구조분해에 `generatedAt,`
3. `<SnapshotSummarySection …>`에 `asOf={generatedAt}`

- [ ] **Step 6: 테스트 통과 확인**

```bash
yarn vitest run src/views/symbol/snapshot
yarn typecheck
```

Expected: snapshot 디렉터리 전체 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/views/symbol/snapshot
git commit -m "feat(snapshot): thread generatedAt through all seven prose renderers

The chart and overall tabs also tell readers explicitly that the live
analysis lives in the analysis panel, since those two show both at once."
```

---

## Task 11: 11개 호출부에서 `generatedAt` 전달

**Files:** 아래 표의 전 파일

**배경:** 렌더러는 7개지만 **호출부는 11곳**이다. `options/page.tsx`는 한 파일에 3곳(degraded/empty/main)이고, `*Degraded.tsx` 3개는 스냅샷 행이 아니라 `content`만 받으므로 **prop을 새로 뚫어야 한다.** 하나라도 빠지면 그 탭만 날짜 없이 렌더되어 불일치가 생긴다.

> ⚠️ `snap`이라는 변수에 속지 말 것 — 7개 페이지 모두 `generateMetadata` **안**에만 있는 지역 변수이고 렌더 시점에는 스코프 밖이다. 아래 표의 변수명을 쓴다. `financials/page.tsx:186`의 `const { snapshot, scorecard } = …`는 **무관한** 변수다.

| 페이지 | 스냅샷 행 변수 | 렌더 위치 |
|---|---|---|
| `src/app/[symbol]/page.tsx` | `technicalSnapshot` (`:123`) | `:367` |
| `src/app/[symbol]/overall/page.tsx` | `overallSnapshot` (`:197`) | `:351` |
| `src/app/[symbol]/fundamental/page.tsx` | `fundamentalSnapshot` (`:500`) | `:637` |
| `src/app/[symbol]/financials/page.tsx` | `financialsSnapshot` (`:151`) | `:293` |
| `src/app/[symbol]/congress/page.tsx` | `congressSnapshot` (`:144`) | `:285` |
| `src/app/[symbol]/options/page.tsx` | `optionsSnapshot` (`:172`) | **`:200`, `:233`, `:368`** |
| `src/app/[symbol]/news/page.tsx` | `newsSnapshot` (`:323`) | `:383` |

- [ ] **Step 1: 페이지 7개(렌더 9곳) 배선**

각 렌더 위치에 `generatedAt={<변수>?.generatedAt}`를 추가한다. `src/app/[symbol]/page.tsx`:

```tsx
                <TechnicalSnapshotProse
                    content={technicalSnapshot?.content}
                    symbol={ticker}
                    displayName={displayName}
                    generatedAt={technicalSnapshot?.generatedAt}
                />
```

`options/page.tsx`는 **3곳 모두** 고친다. 하나만 고쳐도 타입 오류가 나지 않고(모두 optional), degraded/empty 분기는 E2E가 닿지 않으며 `page.tsx`는 커버리지 제외 대상이라 **아무도 잡아주지 않는다.** 직접 3곳을 확인한다:

```bash
grep -n "OptionsSnapshotProse" src/app/\[symbol\]/options/page.tsx
```

Expected: import 1줄 + 렌더 3곳.

- [ ] **Step 2: Degraded 래퍼 3개에 prop 신설**

`fundamental/FundamentalDegraded.tsx`, `financials/FinancialsDegraded.tsx`, `congress/CongressDegraded.tsx`는 `snapshotContent?: unknown`만 받는다. 각각 props에 추가하고:

```tsx
    /** 스냅샷 행의 `generatedAt`. 프로즈 셸의 기준일 캡션에 쓴다. */
    snapshotGeneratedAt?: Date;
```

구조분해에 넣은 뒤, 내부 `*SnapshotProse` 호출에 `generatedAt={snapshotGeneratedAt}`를 전달한다. 그리고 이 래퍼들을 렌더하는 **호출부**에서 `snapshotGeneratedAt={<스냅샷변수>?.generatedAt}`를 넘긴다.

호출부를 찾는 명령:

```bash
grep -rn "FundamentalDegraded\|FinancialsDegraded\|CongressDegraded" src/app/ | grep -v __tests__
```

- [ ] **Step 3: 누락이 없는지 기계적으로 확인**

```bash
grep -rn "SnapshotProse" src/app/ | grep -v import | grep -v __tests__ | wc -l
grep -rn "generatedAt" src/app/ | grep -v __tests__ | wc -l
```

Expected: 첫 번째가 11(렌더 호출 수), 두 번째가 그 이상(각 호출부 + Degraded prop 전달).

- [ ] **Step 4: 타입·테스트 확인**

```bash
yarn typecheck
yarn vitest run "src/app"
```

Expected: 타입 오류 없음, 기존 페이지 스냅샷 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/[symbol]"
git commit -m "feat(symbol): pass snapshot generatedAt into every prose call site

Eleven of them: seven pages (options renders the prose three times) plus
the three Degraded wrappers, which only forwarded content and needed a
new prop. Missing any one leaves that tab without a date."
```

---

## Task 12: 모바일 입력 도달성 E2E 회귀 가드

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/specs/mobile-input-reachability.spec.ts`
- Modify: `e2e/specs/mobile-analysis-sheet.spec.ts` (비회원 입력 케이스 추가)

**배경:** P0가 전 스위트를 통과한 이유는 "회원 동선 무커버"가 아니다 — 막힌 입력 3종 중 **헤더 검색과 챗봇은 비회원도 도달 가능**하다. 진짜 원인은 **모바일 뷰포트에서 차트 라우트를 열고 실제 입력을 시도하는 프로젝트가 없었다**는 것이다. 그래서 두 갈래로 나눈다.

- [ ] **Step 1: 비회원 모바일 입력 케이스 추가**

`e2e/specs/mobile-analysis-sheet.spec.ts`(이미 `@webkit` 태그로 iPhone 14에서 도는 스펙)에 아래 두 테스트를 추가한다. 이 파일이 쓰는 import 스타일(`../support/fixtures`)을 그대로 따른다.

```ts
    test('시트가 열려 있어도 헤더 종목 검색에 타이핑할 수 있다 @webkit', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();

        const search = page.locator('header input').first();
        await search.tap();
        await search.fill('TSLA');

        await expect(search).toHaveValue('TSLA');
    });

    test('시트가 열려 있어도 챗봇 입력에 타이핑할 수 있다 @webkit', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();

        await page.getByRole('button', { name: /챗봇|채팅|문의/ }).first().tap();

        const chatInput = page.locator('textarea').first();
        await chatInput.tap();
        await chatInput.fill('안녕하세요');

        await expect(chatInput).toHaveValue('안녕하세요');
    });
```

> 챗봇 버튼의 접근 가능한 이름은 `src/widgets/chat/FloatingChatButton.tsx`에서 확인해 정확한 값으로 좁힌다. 위 정규식은 출발점이다.

- [ ] **Step 2: Playwright 프로젝트 추가**

`playwright.config.ts`의 `ACCOUNT_SPECS`(34~35행) 아래에 **별도 상수**를 만든다. `ACCOUNT_SPECS`에 신규 스펙을 넣으면 안 된다 — 이 상수는 `authed.testMatch`와 anon `testIgnore`에 **동시에** 쓰여서, 추가하는 순간 Desktop Chrome에서도 매치되어 중복 실행되고 실패한다(데스크탑은 시트가 마운트되지 않는다).

```ts
/**
 * 모바일 뷰포트 + 로그인 상태에서만 의미가 있는 스펙. `authed`가 Desktop Chrome
 * 전용이라 모바일에서 차트 라우트에 실제 입력을 시도하는 프로젝트가 아예 없었고,
 * 그 공백에서 "시트 밖 입력이 전부 막히는" P0 결함이 전 스위트를 통과했다.
 */
const AUTHED_MOBILE_SPECS = /mobile-input-reachability\.spec\.ts/;
```

`projects` 배열에 새 프로젝트를 넣고, anon 프로젝트의 `testIgnore`를 배열로 확장한다:

```ts
        {
            name: 'authed-mobile',
            testMatch: AUTHED_MOBILE_SPECS,
            dependencies: ['setup'],
            use: {
                ...devices['Pixel 7'],
                storageState: AUTH_STORAGE_STATE,
            },
        },
        {
            name: 'chromium',
            testIgnore: [ACCOUNT_SPECS, AUTHED_MOBILE_SPECS],
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            grep: /@webkit/,
            testIgnore: [ACCOUNT_SPECS, AUTHED_MOBILE_SPECS],
            use: { ...devices['iPhone 14'] },
        },
```

`projects` 위 JSDoc 블록에도 한 줄 추가한다:

```
 *   authed-mobile
 *            → mobile-input-reachability.spec.ts. Pixel 7 + storageState.
 *              Guards the class of bug where the mobile analysis sheet makes
 *              everything outside it unreachable; `authed` is desktop-only and
 *              could never have caught it.
```

- [ ] **Step 3: 회원 회귀 스펙 작성**

`e2e/specs/mobile-input-reachability.spec.ts`. **import는 `../support/fixtures`에서** 한다 — 모든 형제 스펙이 그렇게 하며, 외부 요청 가드가 여기 붙어 있다.

```ts
import { test, expect } from '../support/fixtures';

/**
 * 모바일 차트 페이지에서 분석 바텀시트가 마운트된 상태로도 시트 **밖** UI가
 * 정상 동작하는지 고정한다.
 *
 * 회귀 배경: vaul 1.1.2가 `modal={false}`를 내부 Radix Dialog에 전달하지 않아
 * Radix가 modal 모드로 돌았고, FocusScope가 시트 밖 입력의 포커스를 즉시
 * 되돌려 평단 팝오버·헤더 검색·챗봇 입력이 전부 먹통이었다.
 * `.yarn/patches`의 vaul 패치가 그 passthrough를 복구한다.
 *
 * 비회원도 닿는 헤더 검색·챗봇은 `mobile-analysis-sheet.spec.ts`가 맡고,
 * 여기서는 로그인이 필요한 평단 팝오버와 레이아웃 불변식만 검사한다.
 */
test.describe('모바일 차트 페이지 입력 도달성 (authed, 시트 마운트 상태)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/AAPL');
        // 시트는 rAF + 50ms 뒤에 열린다. 열리기 전에 단언하면 공허하게 통과한다.
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();
    });

    test('평단 팝오버의 수량·평단 입력에 실제로 타이핑할 수 있다', async ({
        page,
    }) => {
        await page.getByRole('button', { name: /평단/ }).first().tap();

        const dialog = page.getByRole('dialog', { name: /AAPL 평단 설정/ });
        await expect(dialog).toBeVisible();

        const quantity = dialog.getByLabel('수량');
        const averagePrice = dialog.getByLabel('평단');

        await quantity.tap();
        await quantity.fill('12');
        await averagePrice.tap();
        await averagePrice.fill('321.5');

        // 값이 실제로 반영돼야 한다 — 포커스를 빼앗기면 빈 문자열로 남는다.
        await expect(quantity).toHaveValue('12');
        await expect(averagePrice).toHaveValue('321.5');
    });

    test('평단 팝오버가 뷰포트 안에 완전히 들어온다', async ({ page }) => {
        await page.getByRole('button', { name: /평단/ }).first().tap();

        const dialog = page.getByRole('dialog', { name: /AAPL 평단 설정/ });
        await expect(dialog).toBeVisible();

        await expect(async () => {
            const box = await dialog.boundingBox();
            const viewport = page.viewportSize();
            expect(box).not.toBeNull();
            expect(viewport).not.toBeNull();
            if (box === null || viewport === null) return;

            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y).toBeGreaterThanOrEqual(0);
        }).toPass();
    });

    test('시트 밖 앱 트리에 aria-hidden이 붙지 않는다', async ({ page }) => {
        const headerAriaHidden = await page
            .locator('header')
            .first()
            .getAttribute('aria-hidden');

        expect(headerAriaHidden).toBeNull();
    });

    test('초기 스냅에서 캔들·거래량 차트가 시트에 가려지지 않는다', async ({
        page,
    }) => {
        const sheet = page.locator('[data-vaul-drawer]');
        const candles = page.getByRole('img', { name: /캔들 차트/ });
        const volume = page.getByRole('img', { name: /거래량 차트/ });

        // vaul의 스냅 애니메이션(0.5s transition)이 끝날 때까지 재시도한다.
        await expect(async () => {
            const sheetBox = await sheet.boundingBox();
            expect(sheetBox).not.toBeNull();
            if (sheetBox === null) return;

            for (const chart of [candles, volume]) {
                const chartBox = await chart.boundingBox();
                expect(chartBox).not.toBeNull();
                if (chartBox === null) return;
                expect(chartBox.y + chartBox.height).toBeLessThanOrEqual(
                    sheetBox.y
                );
            }
        }).toPass();
    });
});
```

- [ ] **Step 4: 백엔드 기동 + DB 시드**

```bash
yarn e2e:up
node_modules/.bin/dotenv -e .env.e2e -o -- yarn e2e:db
```

Expected: postgres/redis healthy, `e2e:db: global-setup complete`.

- [ ] **Step 5: 신규 스펙 실행**

```bash
node_modules/.bin/dotenv -e .env.e2e -o -- node_modules/.bin/playwright test --workers=1 mobile-input-reachability
```

Expected: 4개 테스트 전부 PASS.

> `--workers=1`은 필수다. 병렬로 돌리면 authed 스펙들이 같은 DB에 동시 쓰기를 해 보유종목 행이 중복되거나 지워져 실패한다(실측 확인됨).

- [ ] **Step 6: 회귀 스펙 실행**

modal 모드 DOM을 전제로 쓰인 스펙들을 포함한다:

```bash
node_modules/.bin/dotenv -e .env.e2e -o -- node_modules/.bin/playwright test --workers=1 \
  mobile-analysis-sheet symbol-chat symbol-tabs portfolio-holdings portfolio-position personalized-analysis symbol-analysis
```

Expected: 전부 PASS.

- [ ] **Step 7: 낡은 주석 갱신**

아래 두 스펙에는 "Radix의 aria-hidden을 우회한다" / "vaul's Radix Dialog marks the sibling chat panel aria-hidden" 취지의 주석이 있다. 패치 이후 사실이 아니므로 갱신한다(우회 코드 자체는 동작하므로 그대로 두되, 이유를 바로잡는다).

- `e2e/specs/symbol-tabs.spec.ts:98-124`
- `e2e/specs/symbol-chat.spec.ts:44-58`

- [ ] **Step 8: 커밋**

```bash
git add playwright.config.ts e2e/specs
git commit -m "test(e2e): guard mobile input reachability on the chart route

No project ran the chart route on a mobile viewport with real input, so
nothing could observe the sheet making every outside input unreachable.
Guests cover header search and chat in the webkit spec; the new
authed-mobile project covers the member-only holding popover."
```

---

## Task 13: 실증 — 3기기 재측정 + 브라우저 육안 확인

**Files:** 없음 (검증 산출물만)

**배경:** 스펙 §5.3이 약속한 실증이다. 단위/E2E가 통과해도 §1의 수치가 실제로 뒤집혔는지는 별도로 확인해야 한다.

- [ ] **Step 1: prod-like 서버 기동**

```bash
yarn e2e:up
node_modules/.bin/dotenv -e .env.e2e -o -- yarn e2e:db
node_modules/.bin/dotenv -e .env.e2e -o -- node_modules/.bin/next dev --turbopack -p 4300
```

- [ ] **Step 2: 입력 도달성 재측정 (iPhone 14 + Pixel 7)**

수정 전 기록: `수량/평단 focused after tap: false`, `value: ""`, `popover aria-hidden ancestry: HEADER`, 헤더 검색·챗봇 `BLOCKED`.

기대 결과: 세 입력 모두 값이 반영되고, `aria-hidden ancestry: none`.

- [ ] **Step 3: 팝오버 배치 재측정 (iPhone SE 320 + iPhone 14 390)**

수정 전 기록:

| 팝오버 | iPhone SE | iPhone 14 |
|---|---|---|
| 평단 설정 | x=−88..200, 시트에 가림 | x=−18..270, 시트에 가림 |
| 분석 설정 | x=16..304, 시트에 가림 | x=86..374, 시트에 가림 |

기대 결과: 두 팝오버 모두 `x ≥ 0`, `right ≤ vw`, 그리고 시트에 가려지지 않음.

- [ ] **Step 4: 시트 스냅 재측정 (iPhone 14 / iPhone SE / Pixel 7)**

수정 전: 세 기기 모두 `sheetVisibleRatio ≈ 0.52`, 차트 하단이 시트에 가림.

기대 결과: `sheetVisibleRatio ≈ 0.15`, 캔들·거래량 차트 하단 y가 시트 상단 y보다 작음, "AI 분석 중" 배너는 여전히 보임.

- [ ] **Step 5: 브라우저 육안 확인 (Claude Chrome)**

데스크탑·모바일 동선을 실제 브라우저로 확인하고 캡처를 남긴다.

1. 데스크탑 `/AAPL`: 평단 팝오버가 종전대로 칩에 앵커되어 열리고 입력 가능
2. 모바일 `/AAPL`: 첫 화면에 차트가 보이고 시트는 하단 15%
3. 모바일: 평단 팝오버가 화면 중앙에 뜨고 시트에 가리지 않으며 입력 가능
4. 모바일: 분석 설정(⚙) 메뉴도 동일
5. 스크롤 하단: "기술적 분석 요약" 카드에 `지난 AI 분석` 배지와 실제 날짜 캡션, 안내 문구

- [ ] **Step 6: 결과 기록**

측정 수치와 캡처를 `docs/qa/2026-08-01-mobile-ux-verification.md`로 남긴다. 수정 전/후를 나란히 적어 §1 표와 대조 가능하게 한다.

```bash
git add docs/qa/2026-08-01-mobile-ux-verification.md
git commit -m "docs(qa): record before/after measurements for the mobile UX fixes"
```

---

## Task 14: 전체 게이트 통과 확인

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 포맷·린트·타입 (CI와 동일한 명령)**

```bash
yarn format:check
yarn lint
yarn typecheck
```

Expected: 전부 통과. CI가 쓰는 것과 같은 스크립트다(`ci.yml:64`, `:76`).

- [ ] **Step 2: 전체 단위 테스트**

```bash
yarn test
```

Expected: 전부 PASS.

- [ ] **Step 3: 커버리지 (직렬 단독 실행)**

```bash
yarn test-coverage
```

Expected: summary 표 출력, 변경 파일 커버리지 90% 이상(`vitest.config.ts:94-99`의 전역 임계값). **exit code만 보지 말고 표를 눈으로 확인한다** — 병렬 실행 시 `coverage/.tmp` 공유로 리포트가 깨지며 exit 0으로 위장된다. 이 명령을 다른 vitest 실행과 동시에 돌리지 않는다.

- [ ] **Step 4: 프로덕션 빌드**

```bash
yarn build > /tmp/siglens-build.log 2>&1; echo "exit=$?"
```

Expected: `exit=0`. 파이프(`| tail`)를 쓰면 실패가 exit 0으로 가려지므로 반드시 리다이렉트 후 종료 코드를 직접 확인한다.

- [ ] **Step 5: 게이트에서 발견된 수정 커밋**

이 태스크 자체는 코드 변경이 없다. 수정이 생기면 원인 태스크 번호를 커밋 메시지에 명시한다.

---

## Self-Review

**Spec coverage**

| 스펙 항목 | 태스크 |
|---|---|
| §3.1 vaul 패치 (mjs + cjs), `resolutions` + `yarn.lock` 커밋 | Task 1 |
| §3.1 패치 무결성 가드 | Task 2 |
| §3.1 `useRestoreBodyPointerEvents` 제거 + 근거 주석 | Task 3 |
| §3.2 공유 팝오버 표면(포털) | Task 5 |
| §3.2 평단 팝오버 적용 | Task 6 |
| §3.2 분석 설정 메뉴 적용 | Task 7 |
| §3.3 `formatSnapshotAsOf` | Task 8 |
| §3.3 셸 `asOf` 배지·캡션 | Task 9 |
| §3.3 7개 렌더러 배선 + technical·overall 상호참조 문구 | Task 10 |
| §3.3 11개 호출부 배선(Degraded 3개 포함) | Task 11 |
| §3.4 초기 스냅 PEEK + 기존 테스트 반전 + 상수 주석 | Task 4 |
| §5.1 단위 테스트 | Task 2·3·4·5·6·7·8·9·10 각 Step 1 |
| §5.2 anon 모바일(검색·챗봇) | Task 12 Step 1 |
| §5.2 `authed-mobile` 프로젝트 + 라우팅 정정 | Task 12 Step 2 |
| §5.2 평단 입력·bbox·aria-hidden·차트 가시성 | Task 12 Step 3 |
| §5.2 기존 스펙 회귀(symbol-chat·symbol-tabs 포함) + 낡은 주석 갱신 | Task 12 Step 6·7 |
| §5.3 3기기 재측정 + 브라우저 육안 확인 + 기록 | Task 13 |
| §5.3 커버리지 직렬 측정 | Task 14 Step 3 |

빠진 스펙 요구사항 없음. 스펙에 없는 플랜 작업 없음.

**Placeholder scan** — TBD/TODO 없음. 코드가 필요한 모든 스텝에 실제 코드가 있다. Task 7 Step 1과 Task 10 Step 5는 파일마다 props가 달라 "기존 헬퍼 재사용" 또는 "3가지 변경 반복"으로 기술했으며, 변경 내용을 명시하고 새 변수 생성을 금지했다.

**Type consistency** — `formatSnapshotAsOf(date: Date): string` (Task 8) → `SnapshotSummarySection`의 `asOf?: Date` (Task 9) → 렌더러의 `generatedAt?: Date` (Task 10) → Degraded 래퍼의 `snapshotGeneratedAt?: Date` (Task 11) → 페이지의 `<변수>?.generatedAt` (`SeoAnalysisSnapshot.generatedAt: Date`). 전 구간 일치. prop명이 계층마다 다른 것은 의도적이다 — 셸은 표현 의미(`asOf`), 렌더러는 DB 필드명(`generatedAt`), 래퍼는 소유 대상 명시(`snapshotGeneratedAt`).

**명령어 일관성** — 전 태스크가 `yarn typecheck` / `yarn lint <path>` / `yarn format:check` / `yarn vitest run <path>`만 쓴다. `npx tsc`, `npx prettier`, `yarn lint --file`은 등장하지 않는다.
