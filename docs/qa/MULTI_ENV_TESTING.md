# 멀티 환경 테스트 절차 (Chrome/Safari × Desktop/Mobile)

> UI/사용성 변경은 **브라우저 엔진 × 뷰포트** 매트릭스로 검증한다. 도구가 엔진별로 갈리므로
> 어떤 환경을 어떤 도구로 보는지 표준화해 누락(특히 Safari·모바일)을 막는다.

---

## 1. 기본 매트릭스 (4조합)

| | Desktop | Mobile |
|---|---|---|
| **Chrome (Blink)** | claude-in-chrome 또는 Playwright chromium | Playwright chromium + 모바일 device |
| **Safari (WebKit)** | Playwright webkit (Desktop Safari device) | Playwright webkit (iPhone 14 device) |

UI/사용성 변경이면 **4조합 모두**를 기본으로 한다. 피드백으로 누락됐던 Safari·모바일이 항상 포함되도록.

---

## 2. 도구 매핑

- **claude-in-chrome (MCP)** — **Chrome 전용**. Safari/모바일 WebKit은 볼 수 없다. 빠른 수동 확인용.
- **Playwright** — 엔진/디바이스를 모두 커버. 자동화·재현·CI에 사용.
  - `webkit` 프로젝트 = Safari 엔진. `devices['Desktop Safari']` / `devices['iPhone 14']`로 뷰포트 지정.
  - 임시 검증 스크립트 예: chromium/webkit × {desktop viewport, Pixel 7, iPhone 14}를 순회.

```js
const { chromium, webkit, devices } = require('playwright');
await run(chromium, 'CHROME-desktop', { viewport: { width: 1280, height: 800 } });
await run(chromium, 'CHROME-mobile',  { ...devices['Pixel 7'] });
await run(webkit,   'SAFARI-desktop', { ...devices['Desktop Safari'] });
await run(webkit,   'SAFARI-mobile',  { ...devices['iPhone 14'] });
```

---

## 3. 커밋되는 E2E에서의 엔진 분기 (Playwright 프로젝트)

`playwright.config.ts`의 프로젝트 구성:

- **`chromium`** — `devices['Desktop Chrome']`, account 스펙 제외한 **모든 스펙** 실행.
- **`webkit`** — `devices['iPhone 14']`(모바일 뷰포트), **`grep: /@webkit/`** 즉 `@webkit` 태그된 테스트만.

따라서 한 스펙을 **데스크톱 Chrome + 모바일 Safari 양쪽**에서 돌리려면, 그 테스트 제목에 `@webkit`
태그를 붙인다. webkit 프로젝트가 grep을 **전체 제목**(describe + test)에 적용하므로 **describe와 test
제목 양쪽**에 `@webkit`을 둔다.

```ts
test.describe('@webkit 긴 본문 오버플로우', () => {
  test('@webkit 모달이 뷰포트를 넘지 않고 본문만 스크롤된다', async ({ page }) => { ... });
});
```

→ chromium(데스크톱)에서도 실행되고(태그 무관, 모든 스펙 실행), webkit(iPhone 14 모바일)에서도 실행된다.

---

## 4. 검증 항목 (UI 공통)

- 레이아웃: 뷰포트 초과 없음(`max-h-[85dvh]` 등), 가로 오버플로우 없음(`document.scrollWidth ≤ clientWidth`).
- 스크롤: 내부 스크롤 영역이 실제 스크롤 가능한지(`scrollHeight > clientHeight`), 푸터/버튼이 뷰포트 내 유지.
- 모바일: `dvh` 단위로 주소창 변동 대응, 터치 타깃 크기, 시트/모달 거동.
- a11y: 키보드 포커스 도달성(스크롤 영역 `tabIndex={0}` + `role="region"` + `aria-label`).

> 로컬은 통과하는데 CI에서만 실패하면 추측하지 말고 playwright-report 아티팩트(error-context a11y
> 스냅샷 + 스크린샷/trace)를 직접 분석한다 → [EMPIRICAL_VERIFICATION.md](./EMPIRICAL_VERIFICATION.md).

---

## 5. CSS 전용 회귀 — 한글 음절 줄바꿈 · 숫자 컬럼 오버플로 (375px)

PR #674에서 좁은 모바일 폭에서만 드러나는 두 가지 레이아웃 회귀를 CSS로 수정했다. 이 클래스는
**vitest/jsdom이 레이아웃을 계산하지 않아 유닛 테스트로 잡히지 않으므로**, 375px 실렌더로 확인한다.

**증상 & 근본 수정**

- 한글이 음절 단위로 쪼개짐(예: "약세"→"약"/"세", "리스크"→"리스"/"크") → 전역 `body { word-break: keep-all; overflow-wrap: break-word; }`로 어절(공백) 단위 줄바꿈.
- 재무 표 숫자 컬럼이 붙거나("$28.1B$64.1B") 음수 부호가 줄바꿈됨("-$976M"의 `-`) → `StatementTable`/`OptionsChainTable` 셀에 `px-3 whitespace-nowrap`(초과분은 `overflow-x` 스크롤).
- 분석 헤더가 좁은 폭에서 짓눌려 쪼개짐 → `AnalysisPanel` 헤더를 `flex-col sm:flex-row sm:justify-between` 반응형 스택으로.

**375px 확인 절차** (대상: `/[symbol]/financials`, `/[symbol]`)

1. 전역 규칙 활성 확인: `getComputedStyle(document.body).wordBreak === 'keep-all'`.
2. 현금흐름표 CapEx 음수 셀("-$976M" 등)이 **단일 줄**인지 — 셀 높이가 1줄 높이인지 확인(부호가 윗줄로 깨지지 않음).
3. 표 숫자 컬럼이 붙지 않고 스크롤 컨테이너가 **가로 스크롤 가능**한지 — `region.scrollWidth > region.clientWidth`.
4. AI 분석 헤더 배지(예: "약세"/"보합")와 "리스크 …" 라벨이 **음절 단위로 쪼개지지 않는지** — 각 배지/라벨이 단일 줄.

> 실렌더 팁: 창이 OS 최소 폭(예: ~1500px)에 걸려 뷰포트를 375px로 줄일 수 없으면, 대상 카드/표
> 컨테이너를 직접 좁혀 재현한다 — `section.style.width = '345px'` 후 위 2~4를 셀 높이·`scrollWidth`로
> 측정(§4의 `document.scrollWidth ≤ clientWidth` 원칙과 동일). 미디어쿼리(`sm:`) 분기는 실뷰포트가
> 필요하므로 Playwright `devices['iPhone 14']`(webkit) 프로젝트로 자동화한다.

**자동화 상태**: 위 절차의 Playwright 375px 시각 회귀 스펙은 **issue #676**로 추적한다(작성 전까지는
이 수동 절차가 게이트).
