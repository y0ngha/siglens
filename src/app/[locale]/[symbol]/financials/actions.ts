/**
 * App-level server actions for the financials route.
 * Re-exports from the entities layer so app code and tests share a single import.
 *
 * The canonical implementation lives in:
 *   src/entities/financials-statements/actions/getFinancialsQuarterAction.ts
 *
 * This file exists so `app/[symbol]/financials/` can expose it alongside the
 * route-specific data loaders. If this route needs additional financials
 * actions in the future, add them here following the same pattern.
 */
export { getFinancialsQuarterAction } from '@/entities/financials-statements/actions';
