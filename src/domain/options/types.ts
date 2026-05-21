/**
 * Options-domain types specific to the siglens application layer
 * (separate from raw chain/snapshot types exported by @y0ngha/siglens-core).
 */

/**
 * UI-level expiration filter value used by the expiration selector and
 * downstream chain/metrics views. An ISO 'YYYY-MM-DD' string selects a
 * single expiration; `'all'` aggregates every expiration in the snapshot.
 *
 * The `(string & {})` intersection prevents TypeScript from widening the
 * union to bare `string` (which would drop the `'all'` autocomplete in
 * IDEs and erase the literal hint at call sites). Runtime behavior is
 * identical to `string | 'all'`; this trick is purely an editor-DX guard.
 * Mirrors siglens-core's R18 `OptionsExpirationFilter` for consistency.
 */
export type OptionsExpirationSelector = (string & {}) | 'all';
