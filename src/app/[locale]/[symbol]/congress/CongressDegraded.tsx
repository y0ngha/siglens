import { useTranslations } from 'next-intl';
import { SymbolDegradedShell } from '@/app/[locale]/[symbol]/SymbolDegradedShell';
import { CongressSnapshotProse } from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';

interface CongressDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
    /**
     * `seo_analysis_snapshots.content` for the congress tab, when a
     * pre-warmed snapshot exists. Threaded through so degraded pages stay
     * crawlable — spec 2026-07-24 §7: "본문 degraded 분기에서도 섹션 유지".
     * `CongressSnapshotProse` itself renders `null` when the content is
     * absent/empty, so this prop is safe to pass unconditionally.
     */
    snapshotContent?: unknown;
    /** 스냅샷 행의 `generatedAt`. 프로즈 셸의 기준일 캡션에 쓴다. */
    snapshotGeneratedAt?: Date;
}

/**
 * Rendered when the FMP congress trades provider is temporarily unavailable
 * (infra failure — `getCongressTradesResilient` returned `degraded: true`) on
 * the congress route.
 *
 * NOTE: A zero-trade result is NOT a degrade signal on this route. Many tickers
 * legitimately have no congressional trades on record, and that case renders
 * the normal page with the table's empty state — it stays indexable. Only
 * FMP-infra failure flips to this degraded (noindex via `generateMetadata`,
 * soft-200) UI.
 *
 * Mirrors `FinancialsDegraded`: keeps exactly one `<h1>` (SEO) and the
 * cross-route links so the visitor can still reach other tabs while the data
 * provider recovers.
 */
export function CongressDegraded({
    displayName,
    symbol,
    snapshotContent,
    snapshotGeneratedAt,
}: CongressDegradedProps) {
    const t = useTranslations('app.symbol');
    return (
        <SymbolDegradedShell
            heading={`${displayName} ${t('CongressDegraded.7b06ac')}`}
            noticeTitle={t('CongressDegraded.ea5528')}
            noticeBody={t('CongressDegraded.508fee')}
            symbol={symbol}
            current="congress"
        >
            <CongressSnapshotProse
                content={snapshotContent}
                symbol={symbol}
                displayName={displayName}
                // congress 탭은 us-equity 전용이다 — CongressSnapshotProseProps
                // JSDoc 참고.
                marketProfile="us-equity"
                generatedAt={snapshotGeneratedAt}
            />
        </SymbolDegradedShell>
    );
}
