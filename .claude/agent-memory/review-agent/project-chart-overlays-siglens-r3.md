---
name: project-chart-overlays-siglens-r3
description: siglens feat/chart-overlays R3 — R2 toggle-in-cleanup fixed with an idempotent onClear chain; only nit left is a stale JSDoc naming onToggle
metadata:
  type: project
---

R3 (2026-09-28). The clear chain (onClearOverlayHighlight → onClearHighlight → onClear, `prev===ref ? null : prev`) is threaded to both pattern and strategy items. The harness test mirrors ChartContent's render-phase reset. 401 scoped tests are green. The e2e group locators are scoped by name, which matches ChartOverlayMenu's role=group with aria-label=triggerLabel.
- Nit: the OverlayHighlightButton JSDoc still says the cleanup reads `isHighlighted`/`onToggle` from the ref.

**How to apply:** if there's an R4, just confirm the JSDoc wording is fixed.
