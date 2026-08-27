---
name: related-visibility-footer-r2
description: RelatedSymbols move to symbol layout (footer visibility fix) — round 2 closed, approved
metadata:
  type: project
---

Branch `worktree-fix-related-visibility-footer`, round 2 (round 1 had required:[], 3 recommended).
Bug: RelatedSymbols chips were nested inside the chart tab's own `overflow-y-auto` scroller
(inside SymbolLayoutJail, which is `overflow-hidden` + definite height), so scrolling the page to
the footer never reached them — DOM-present, crawler-visible, but unreachable by a human scrolling.
Fix: moved `<RelatedSymbols>` to be a layout-level sibling of `SymbolLayoutJail`, outside the jail,
so it's reached by normal page scroll, positioned right above the footer.

Round 2 modified_files were narrow: `src/app/[symbol]/layout.tsx` (comment-only) and
`src/shared/config/__tests__/relatedSymbols.test.ts`.

Verified both R1 recommended-finding rebuttals:
1. Soft-404 chip visibility: confirmed `app/not-found.tsx` genuinely renders `<TickerCategories />`
   (~400-symbol grid) unconditionally — the "navigation on not-found is deliberate" claim is real,
   not asserted. Architectural reasoning (shell already flushed before notFound() bubbles, so only
   `{children}` swaps, not the whole SymbolLayout output) is consistent with the file's own
   documented soft-404 mechanics from round 1.
2. Test tightening `!s.startsWith('XL')` → `SECTOR_ETFS` membership: mutation-verified live by
   removing the `sectorEtfSymbols.has(s)` clause — exactly 1 test fails (`LLY의 앞 6칸이 전부
   테마 피어다`, received `['XLV']`). Hand-traced `themePeersOf` for LLY (sectorSymbol XLV in
   dashboard-tickers.ts → genuine SECTOR_ETFS-derived theme group) vs RKLB/NVDL (no SECTOR_STOCKS
   entry, so the ETF fallback path is structurally never reached for those two rows). Confirms the
   exception is real and exactly as narrow as claimed — not a laundered escape hatch.

Approved, round 2, zero findings.
