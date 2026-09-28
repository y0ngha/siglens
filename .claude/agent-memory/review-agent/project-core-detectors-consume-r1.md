---
name: project-core-detectors-consume-r1
description: siglens feat/core-detectors-consume R1 (core 1.18.0 bump) — signal-gated skills reference a prompt section that does not exist; macroCalendar callers complete
metadata:
  type: project
---

R1 (2026-09-28, worktree siglens-sp3): changes_requested.

- Required: new strategy skills (52-week-high-momentum, gap-analysis) say "interpret only if X is listed in the detected-signal section". Core 1.18.0 never prints new_52w_*/gap_* anywhere: CONFLUENCE_EXCLUDED_TYPES (signals/confluence.js) strips them from the Deterministic Metrics list; detectSignals output otherwise only feeds selectSkills (prompt.js buildSkillSelectionContext). Candle/pattern skills are fine (Detected Candle Patterns / Chart Pattern Candidates sections exist).
- Check for any new signal-gated skill: grep core prompt for where the signal type is rendered before trusting "listed in X section" wording.
- macroCalendar callers verified complete: submitNewsAnalysisAction, prewarmNews, runOverallAnalysisAction, prewarmOverall; SSE route + chat runFreshAnalysis + seo-prewarm cron all route through those. runAnalysisBridge is re-export only.
- Recommended: `.sort` vs `.toSorted` (MISTAKES CP-12); helper test at 23:30Z can't distinguish UTC vs ET window; 52w "close above MA120/MA200" is tautological at a new 52w high.
- Weights all matched SP1 §2.1/§2.3 bands; geometry text matched core patternGeometry.js; i18n hashes = sha1(ko)[:12], verified.
