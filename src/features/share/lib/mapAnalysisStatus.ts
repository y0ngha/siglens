import type { ShareableStatus } from '@/features/share';

/**
 * Maps a raw hook status string (from any analysis hook) to a canonical
 * `ShareableStatus` understood by the share system.
 *
 * Addendum D-1 (options empty-market): `useOptionsAnalysis` does NOT emit a
 * distinct empty-market status token. When options data is unavailable for a
 * symbol, the widget renders a separate `OptionsEmptyState` component and the
 * hook never mounts — so no mapping is needed here. The `no_trades` token
 * (mapped to 'unavailable' below) covers other analysis hooks that explicitly
 * surface a no-data condition via status.
 */
export function mapAnalysisStatus(status: string): ShareableStatus {
    switch (status) {
        case 'done':
            return 'success';

        case 'loading':
        case 'submitting':
        case 'polling':
        case 'pending_dependencies':
            return 'pending';

        case 'bot_blocked':
        case 'no_trades':
            return 'unavailable';

        case 'error':
            return 'error';

        default:
            return 'idle';
    }
}
