// Public barrel for the financials-statements entity.
// Server Actions are exported via actions.ts, not here, to keep the barrel
// tree-shake-friendly and consistent with other entity barrels.
export {
    getFinancialsSnapshot,
    ANNUAL_LIMIT,
    QUARTER_LIMIT,
} from './lib/getFinancialsSnapshot';
