# Yahoo Options Symbol Alias Design

## Goal

Use Yahoo Finance's provider-specific symbol notation for options requests
without changing SigLens canonical ticker URLs, cache keys, or displayed symbols.

## Design

Add a pure shared helper that maps only verified aliases. Initially,
`BRK.B` maps to `BRK-B`; symbols with exchange suffixes such as `VOD.L` and
`7203.T` remain unchanged.

Apply the helper immediately before every `yahoo-finance2.options()` call in
the production adapter and the popular-ticker update script. Do not retry by
blindly replacing dots after an error because unrelated provider failures and
valid exchange suffixes must not be treated as class-share notation.

The adapter restores the requested canonical symbol in the normalized snapshot,
so downstream URLs, cache keys, and UI continue to use `BRK.B`.

## Testing

Cover verified aliases and unchanged exchange suffixes in the pure helper.
Verify all adapter Yahoo calls use the provider symbol while returned snapshots
retain the canonical symbol. Verify the update-script probe uses the provider
symbol without changing its error policy.
