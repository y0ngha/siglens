---
name: feedback-cross-repo-resolution-claims-need-consumer-check
description: when a core-repo fix's resolution claims a specific consumer already handles the new contract, grep that consumer's real source before trusting it
metadata:
  type: feedback
---

siglens-core PRs frequently resolve a "breaking behavior change" finding by asserting "the only
consumer (siglens) already passes/handles X, so this is fine." Do not accept that at face value
— it is a claim about a different repo's current state, made by whoever wrote the core PR, and
it can be stale or simply wrong.

**Why:** in [[project-prompt-precision-currency-r2-currency-thread-gap]], the round-1 resolution
claimed siglens already threads `currency` through to `requestChatCompletion`/`runNewsAnalysis`.
Grepping the actual siglens call sites showed neither one passes it — both derive `assetClass`
via a descriptor that also carries `.priceFormat.currency`, but drop it. The core-side fix
(JSDoc + tests) was itself correct; the resolution's factual premise about the consumer was not.

**How to apply:** whenever a finding's resolution says "consumer X already does Y," grep the
consumer's actual call site (`grep -rln` for the function name, then read the call), don't just
trust the sentence. This is cheap (a few greps) and catches exactly the kind of regression that
survives every test in the reviewed repo because the reviewed repo's tests can't see the other
repo's wiring.
