# Home Hero Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the homepage hero so Siglens feels like a calm, credible U.S. stock AI analysis platform instead of a generic AI SaaS landing page.

**Architecture:** This is a presentation-only change. The homepage already loads `skillCounts`, so the hero subcopy should render the approved dynamic indicator count from `skillCounts.indicators`; no new data fetching, domain logic, or infrastructure changes are needed. Styling changes stay in global hero CSS and existing Tailwind classes.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, Tailwind CSS 4, existing Siglens design tokens in `src/app/globals.css`.

---

## File Structure

- Modify `src/app/page.tsx`
  - Replace hero copy.
  - Use `skillCounts.indicators` in the hero subcopy.
  - Swap the decorative hero background nodes to a calmer report-style surface.
  - Preserve search, market CTA, stats, and existing page order.
- Modify `src/app/globals.css`
  - Replace animated grid/glow hero styles with static low-contrast report lines.
  - Remove the unused `grid-fade` keyframes if no remaining class uses it.
- Modify `src/components/search/TickerAutocomplete.tsx`
  - Update the large/small shared placeholder copy to `종목 입력… 예: AAPL, 애플`.

No new files are required.

---

### Task 1: Update Hero Copy And Layout

**Files:**
- Modify: `src/app/page.tsx:156-199`

- [ ] **Step 1: Replace the hero section markup**

In `src/app/page.tsx`, replace the current hero `<section>` block from:

```tsx
<section className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 text-center sm:py-14 lg:items-start lg:pr-[10vw] lg:pl-[15vw] lg:text-left">
    <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0"
    />
    <div
        aria-hidden="true"
        className="hero-ambient pointer-events-none absolute inset-0"
    />
    <div className="relative w-full max-w-4xl">
        <p className="text-secondary-400 mb-6 font-mono text-xs tracking-[0.3em] uppercase">
            SIGLENS
        </p>
        <h1 className="text-secondary-100 mx-auto max-w-xs text-[2rem] leading-[1.15] font-bold tracking-tight text-balance sm:max-w-none sm:text-5xl lg:mx-0 lg:text-6xl">
            미국 주식,{' '}
            <span className="text-primary-400">
                AI가 읽어주는
                <br className="sm:hidden" /> 시장과 차트
            </span>
        </h1>
        <p className="text-secondary-400 mx-auto mt-4 max-w-xs text-base leading-relaxed sm:max-w-lg sm:text-xl lg:mx-0">
            오늘 주목할 섹터부터 종목별 기술적 분석, AI 대화까지
            한 번에.
        </p>
        <div
            id="search"
            className="mt-8 flex w-full justify-center sm:max-w-xl lg:justify-start"
        >
            <SymbolSearchPanel />
        </div>
        <div className="mt-6 flex justify-center lg:justify-start">
            <Link
                href="/market"
                className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 text-sm font-semibold tracking-wider uppercase transition-colors"
            >
                오늘 주목할 종목 →
            </Link>
        </div>
        <Suspense fallback={<StatsBarSkeleton />}>
            <AsyncStatsBar />
        </Suspense>
    </div>
</section>
```

with:

```tsx
<section className="bg-secondary-950 relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:py-16 lg:min-h-[calc(100svh-9rem)] lg:items-start lg:pr-[10vw] lg:pl-[15vw] lg:text-left">
    <div
        aria-hidden="true"
        className="hero-report-lines pointer-events-none absolute inset-0"
    />
    <div className="relative w-full max-w-4xl">
        <p className="text-secondary-500 mb-5 font-mono text-[0.68rem] leading-relaxed tracking-[0.18em] uppercase sm:text-xs">
            미국 주식 AI 분석 플랫폼, SIGLENS
        </p>
        <h1 className="text-secondary-100 mx-auto max-w-sm text-[2.2rem] leading-[1.1] font-bold tracking-tight text-balance sm:max-w-2xl sm:text-5xl lg:mx-0 lg:text-6xl">
            복잡한 차트 분석을
            <br />
            <span className="text-primary-300">한 번에 정리합니다</span>
        </h1>
        <p className="text-secondary-400 mx-auto mt-5 max-w-sm text-base leading-relaxed sm:max-w-2xl sm:text-lg lg:mx-0">
            티커를 입력하면 RSI, MACD, 볼린저밴드 등 보조지표{' '}
            {skillCounts.indicators}종과 차트 패턴, 전략 신호를 AI가
            분석해 핵심 근거만 보여줍니다.
        </p>
        <div
            id="search"
            className="mt-8 flex w-full justify-center sm:max-w-xl lg:justify-start"
        >
            <SymbolSearchPanel />
        </div>
        <div className="mt-6 flex justify-center lg:justify-start">
            <Link
                href="/market"
                className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 text-sm font-semibold transition-colors"
            >
                오늘 주목할 종목 →
            </Link>
        </div>
        <Suspense fallback={<StatsBarSkeleton />}>
            <AsyncStatsBar />
        </Suspense>
    </div>
</section>
```

- [ ] **Step 2: Check the TypeScript expression**

Confirm the subcopy uses the existing `skillCounts.indicators` from `Home()` and does not introduce a new variable or async dependency:

```tsx
{skillCounts.indicators}종
```

- [ ] **Step 3: Run lint for JSX issues**

Run:

```bash
yarn lint
```

Expected: exits successfully.

---

### Task 2: Replace Hero Background Styles

**Files:**
- Modify: `src/app/globals.css:81-120`

- [ ] **Step 1: Replace the old hero background CSS**

In `src/app/globals.css`, replace:

```css
.hero-grid {
    background-image:
        linear-gradient(
            to right,
            var(--color-secondary-700) 1px,
            transparent 1px
        ),
        linear-gradient(
            to bottom,
            var(--color-secondary-700) 1px,
            transparent 1px
        );
    background-size: 48px 48px;
    opacity: 0.5;
    mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent);
}

.hero-ambient {
    background: linear-gradient(
        180deg,
        color-mix(in oklch, var(--color-primary-900) 20%, transparent) 0%,
        transparent 50%
    );
}

@media (prefers-reduced-motion: no-preference) {
    .hero-grid {
        animation: grid-fade 8s ease-in-out infinite alternate;
    }
}

@keyframes grid-fade {
    from {
        opacity: 0.4;
    }

    to {
        opacity: 0.7;
    }
}
```

with:

```css
.hero-report-lines {
    background:
        linear-gradient(
            180deg,
            color-mix(in oklch, var(--color-secondary-900) 70%, transparent) 0%,
            transparent 42%
        ),
        linear-gradient(
            to right,
            transparent 0,
            transparent calc(100% - 10vw),
            color-mix(in oklch, var(--color-secondary-700) 40%, transparent)
                calc(100% - 10vw),
            transparent calc(100% - 10vw + 1px)
        );
}

.hero-report-lines::before {
    position: absolute;
    top: 0;
    right: 10vw;
    left: 15vw;
    height: 1px;
    content: '';
    background: color-mix(
        in oklch,
        var(--color-secondary-700) 45%,
        transparent
    );
}
```

- [ ] **Step 2: Verify old hero classes are gone**

Run:

```bash
rg -n "hero-grid|hero-ambient|grid-fade" src
```

Expected: no matches.

- [ ] **Step 3: Run style lint**

Run:

```bash
yarn lint:style
```

Expected: exits successfully.

---

### Task 3: Update Search Placeholder Copy

**Files:**
- Modify: `src/components/search/TickerAutocomplete.tsx:87`

- [ ] **Step 1: Replace the placeholder**

In `src/components/search/TickerAutocomplete.tsx`, replace:

```tsx
placeholder="종목 입력 (예: AAPL, 애플)"
```

with:

```tsx
placeholder="종목 입력… 예: AAPL, 애플"
```

- [ ] **Step 2: Run lint for the component**

Run:

```bash
yarn lint
```

Expected: exits successfully.

---

### Task 4: Manual Visual And Interaction Verification

**Files:**
- Verify: `src/app/page.tsx`
- Verify: `src/app/globals.css`
- Verify: `src/components/search/TickerAutocomplete.tsx`

- [ ] **Step 1: Start the dev server**

Run:

```bash
yarn dev
```

Expected:

```text
Local: http://localhost:4200
Ready
```

- [ ] **Step 2: Review desktop homepage**

Open `http://localhost:4200`.

Expected:

- Eyebrow reads `미국 주식 AI 분석 플랫폼, SIGLENS`.
- H1 reads `복잡한 차트 분석을 / 한 번에 정리합니다`.
- Subcopy includes `RSI`, `MACD`, `볼린저밴드`, a dynamic indicator count, `차트 패턴`, `전략 신호`, and `AI`.
- The first screen feels calm and financial, with no visible animated grid or blue glow.
- Search is still the dominant action.
- The next section remains reachable without the hero feeling empty.

- [ ] **Step 3: Review mobile homepage**

Use browser responsive mode around `390px` width.

Expected:

- Eyebrow wraps cleanly without overflow.
- H1 remains readable and does not collide with the search box.
- Subcopy line length is comfortable.
- Search input and button stack as before.

- [ ] **Step 4: Verify search interaction**

On `http://localhost:4200`, click the search input and type:

```text
AAPL
```

Expected:

- Autocomplete opens.
- Keyboard navigation still moves through options.
- Search button remains focusable.
- No layout shift occurs when suggestions open.

---

### Task 5: Final Project Verification And Review Routing

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full lint**

Run:

```bash
yarn lint
```

Expected: exits successfully.

- [ ] **Step 2: Run full style lint**

Run:

```bash
yarn lint:style
```

Expected: exits successfully.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff -- src/app/page.tsx src/app/globals.css src/components/search/TickerAutocomplete.tsx
```

Expected:

- Only the approved hero copy, hero styling, and placeholder changes are present.
- No domain, infrastructure, metadata, or unrelated component changes are present.

- [ ] **Step 4: Route to review-agent**

Because `CLAUDE.md` requires review after implementation, invoke `review-agent` with:

```text
Review the homepage hero brand refresh implementation.

Modified files:
- src/app/page.tsx
- src/app/globals.css
- src/components/search/TickerAutocomplete.tsx

Focus on:
- approved copy and SEO visible text placement
- accessibility regressions
- responsive layout risks
- Tailwind/CSS correctness
- unnecessary scope expansion
```

Do not create a commit from the main orchestrator. Commit and push remain the `git-agent` responsibility per `CLAUDE.md`.
