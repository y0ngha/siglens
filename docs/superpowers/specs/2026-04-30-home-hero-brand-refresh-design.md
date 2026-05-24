# Home Hero Brand Refresh Design

## Context

Siglens is a Korean-first AI technical analysis platform for U.S. stocks. The homepage should communicate trust, clarity, and ease of use for a complex domain.

The current hero background uses a visible grid, blue ambient glow, radial masking, and subtle animation. Together these choices make the page feel like a generic AI SaaS landing page rather than a dependable stock analysis tool. The refresh will make the first screen calmer, simpler, and more credible while preserving the SEO value of "AI stock analysis" wording.

## Goal

Refresh the homepage hero so it feels like a focused financial analysis product:

- Lead with the value proposition: complex chart analysis becomes organized and easier to inspect.
- Keep "AI" present for SEO and product clarity without making the H1 feel over-marketed.
- Reduce decorative background complexity.
- Preserve the current primary action: entering a ticker symbol.
- Keep the existing homepage information architecture unless a local adjustment is needed for visual consistency.

## Approved Direction

Use the "calm financial report" direction.

The hero should rely on dark surfaces, measured spacing, thin separators, and restrained Trust Blue accents. It should not rely on animated grids, strong glows, orb-like effects, or dense decorative patterns.

### Approved Copy

Eyebrow:

```text
미국 주식 AI 분석 플랫폼, SIGLENS
```

H1:

```text
복잡한 차트 분석을
한 번에 정리합니다
```

Subcopy:

```text
티커를 입력하면 RSI, MACD, 볼린저밴드 등 보조지표 N종과 차트 패턴, 전략 신호를 AI가 분석해 핵심 근거만 보여줍니다.
```

`N종` must be rendered from the existing `skillCounts.indicators` value already loaded by the homepage. Do not hardcode the count.

## SEO Placement

The homepage metadata already includes AI analysis keywords through `SITE_DESCRIPTION`, `ROOT_TITLE`, and `ROOT_KEYWORDS`. The hero should add visible text support without keyword stuffing.

Required visible placements:

- Eyebrow includes `미국 주식 AI 분석 플랫폼`.
- Subcopy includes `RSI`, `MACD`, `볼린저밴드`, `보조지표`, `차트 패턴`, `전략 신호`, and `AI`.

Avoid putting `AI` back into the H1. The H1 should stay focused on the user-facing benefit.

## Visual Design

### Background

Replace the current AI-like background treatment with a quieter treatment:

- Remove or substantially weaken `.hero-grid`.
- Remove the animated grid fade from the hero.
- Remove or substantially reduce `.hero-ambient` blue glow.
- Prefer a simple dark background based on `secondary-950` / `secondary-900`.
- If visual structure is needed, use one or two thin low-contrast divider lines instead of a full grid.

### Typography

- Keep the H1 large and high contrast.
- Use Trust Blue only for the second H1 line or a small phrase if it improves hierarchy.
- Keep letter spacing restrained. The current eyebrow tracking can be reduced because the approved eyebrow is longer than `SIGLENS`.
- Preserve `text-balance` on the H1.

### Search Area

The ticker search remains the main interaction.

- Keep it directly under the subcopy.
- Keep the button visually prominent with Trust Blue.
- Maintain existing combobox behavior and keyboard support.
- Update the placeholder to align with the web guidelines if the component is touched, for example: `종목 입력… 예: AAPL, 애플`.

### Supporting Trust Signals

The existing stats row and backtesting CTA are useful. They should remain, but the hero-adjacent stats should visually match the calmer report tone.

Recommended treatment:

- Keep stats understated.
- Do not add large badges or marketing chips.
- Keep the backtesting CTA below the hero as the credibility proof point.

## Homepage Composition

The current homepage structure is useful and should remain:

1. Hero search and value proposition.
2. How it works.
3. Backtesting credibility CTA.
4. Skills showcase.
5. Ticker categories.

This composition is sufficiently substantial for the main page. The refresh should not add new sections during the first implementation. If the lower sections feel too card-heavy after the hero refresh, adjust their tone in a separate follow-up pass.

## Accessibility And Interface Guidelines

The current homepage already has a skip link, semantic sectioning, visible focus states, input labeling through `aria-label`, and reduced-motion handling. Preserve those properties.

Implementation should also:

- Avoid `transition-all`; list transitioned properties.
- Keep focus-visible rings on search input, search button, links, and autocomplete options.
- Keep decorative background elements `aria-hidden`.
- Avoid text overflow on mobile by keeping the H1 line breaks and max widths responsive.
- Preserve the combobox ARIA structure.

## Implementation Scope

Expected files:

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/search/TickerAutocomplete.tsx` only if the placeholder is updated.

No domain, infrastructure, or data-fetching changes are expected.

## Verification

After implementation:

- Run `yarn lint`.
- Run `yarn lint:style`.
- Start or reuse `yarn dev` and review `http://localhost:4200`.
- Check desktop and mobile widths.
- Confirm the hero no longer looks like a generic AI landing page.
- Confirm visible copy still includes the approved SEO terms.
- Confirm search input, autocomplete, and keyboard interaction still work.
