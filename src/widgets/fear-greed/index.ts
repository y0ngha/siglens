// fear-greed widget barrel — public API for cross-widget consumers.
// Heavy components (FearGreedPage etc.) are imported directly by app routes,
// not re-exported here, to keep the barrel tree-shake-friendly for tests.

export { FearGreedGauge } from './FearGreedGauge';
export { FearGreedPageError } from './FearGreedPageError';
export { SelfNormWarningBadge } from './SelfNormWarningBadge';

// Hooks re-exported for cross-widget consumption
export { useFearGreedFromSymbol } from './hooks/useFearGreedFromSymbol';
export { useFearGreed } from './hooks/useFearGreed';
