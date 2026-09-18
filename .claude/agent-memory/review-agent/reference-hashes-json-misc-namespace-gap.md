---
name: hashes-json-misc-namespace-gap
description: messages/_meta/hashes.json has no entries for hand-authored keys like shared.ui.misc.liveCrossRef — pre-existing gap, not a new PR defect
metadata:
  type: reference
---

`messages/_meta/hashes.json` only tracks keys in the `namespace.ComponentName.hashslug` shape produced by `scripts/i18n/extract.mjs`. Hand-authored keys (e.g. `shared.ui.misc.liveCrossRef`, referenced via a named export like `LIVE_ANALYSIS_CROSS_REF_KEY`) were never added to hashes.json, so `translate.mjs`'s staleness check (`hashes[key] !== hashOf(newKoText)`) already always treats them as stale/untranslated, regardless of any single PR's edit.

**How to apply:** When a diff reworders a `messages/*.json` value and the key is missing from hashes.json entirely, this is a pre-existing condition, not something the diff introduced — do not flag it as a regression risk unless the key already had a hashes.json entry that the diff failed to update alongside the ko.json edit (that case *is* a real finding: it would cause `translate.mjs --locale X` to overwrite manually-written non-ko translations next run). Grep `messages/_meta/hashes.json` for the exact flattened key before deciding.
