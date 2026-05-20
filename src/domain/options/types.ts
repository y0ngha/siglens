/**
 * Options-domain types specific to the siglens application layer
 * (separate from raw chain/snapshot types exported by @y0ngha/siglens-core).
 */

/**
 * UI-level expiration filter value used by the expiration selector and
 * downstream chain/metrics views. An ISO 'YYYY-MM-DD' string selects a
 * single expiration; `'all'` aggregates every expiration in the snapshot.
 */
export type OptionsExpirationSelector = string | 'all';
