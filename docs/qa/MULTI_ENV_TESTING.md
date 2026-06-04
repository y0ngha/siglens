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
