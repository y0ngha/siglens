---
name: faq-jsonld-visible-folding-pattern
description: siglens `/[symbol]/*` FAQPage JSON-LD must be single-sourced with a visible FaqSection — established fold-guide-prose-into-answers pattern and its edge case (embedded links)
metadata:
  type: reference
---

siglens's `[symbol]` sub-routes (overall/options/fundamental/financials/congress/fear-greed)
share one FAQ pattern: build a `const faq: readonly FaqItem[]` array once, feed it to BOTH
`buildFaqJsonLd(faq)` (JSON-LD) and `<FaqSection items={faq} />` (visible `<dl>`). Google
ignores FAQPage markup that has no matching visible text, so a "guide" prose section that
merely resembles the JSON-LD answers (without ever being rendered together via one array) is
the actual defect, not a style nit.

**Precedent for folding old visible prose into FAQ answers** (not just sr-only text):
`overall/page.tsx` used to have a full visible `guideParagraphs` card (3 paragraphs) alongside
mark-up-only FAQ JSON-LD. The fix absorbed the paragraphs' unique sentences into the FAQ
answers verbatim/paraphrased, deleted the guide section entirely, single-sourced via
`copy.faq`. This is the reference precedent when a route has REAL visible prose (not sr-only)
duplicating FAQ content — see `git diff origin/master -- src/app/[symbol]/overall/page.tsx`
for the exact shape if this pattern needs to be replayed on another route.

**Edge case this precedent doesn't cover: an embedded `<Link>` inside the prose.**
`FaqItem.answer` is `string` — a real internal navigational link (e.g. fear-greed's
cross-link to the site's own market-wide `/fear-greed` or `/fear-greed/kr` index, which
`CrossLinkCards` does NOT cover since it only links same-symbol sibling tabs) cannot be
folded into a JSON-LD answer text. Resolution used: keep a minimal standalone `<p>` with the
real `<Link>` OUTSIDE the FaqSection (not deleted, not folded), and only fold the
purely-descriptive/duplicate sentences into the FAQ array. The hard constraint from the task
was "no visible content may disappear" — that floor applies regardless of whether content
ends up inside or outside the FaqSection; only the Q&A pairs themselves need single-sourcing.

sr-only overview paragraphs may be deleted more liberally than visible prose — precedent
(`fundamental`/`options`) treated "practically the same content, now redundant across the 3
FAQ answers combined" as sufficient, not strict word-for-word matching against a single answer.

Related: `shared/lib/seo.ts` `buildFaqJsonLd` JSDoc explicitly documents this contract; test
helper `src/__tests__/utils/expectFaqSingleSource.ts` asserts `FaqSection` items and JSON-LD
`mainEntity` are order-identical — mirrors the exact real bug (5 routes had valid-but-hidden
JSON-LD for a long time and passed schema validators anyway).
