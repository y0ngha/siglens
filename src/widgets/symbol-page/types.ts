/**
 * Cooldown state surfaced by useAnalysis when a reanalysis attempt is
 * rejected due to the per-symbol cooldown window (REANALYZE_COOLDOWN_MS).
 * Consumed by AnalysisPanel / AnalysisToast (cross-widget) to display
 * the remaining wait time to the user.
 */
export interface CooldownNotice {
    nonce: number;
    remainingMs: number;
}
