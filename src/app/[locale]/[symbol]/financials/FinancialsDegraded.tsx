import { useTranslations } from 'next-intl';
import { SymbolDegradedShell } from '@/app/[locale]/[symbol]/SymbolDegradedShell';
import { FinancialsSnapshotProse } from '@/views/symbol/snapshot/renderers/FinancialsSnapshotProse';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

interface FinancialsDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
    /**
     * Required (no default here, unlike `CrossLinkCards`'s own prop) — this
     * component has exactly one caller (`financials/page.tsx`), which always
     * has the value in hand, so there is no safe default to fall back to.
     * Threading it through prevents the same bug `CrossLinkCards`'s default
     * caused: financials renders for both us-equity and kr-equity, so an
     * omitted/wrong value would link Korean symbols to nonexistent
     * `/options`/`/congress` tabs (SEO audit 2026-08-18).
     */
    marketProfile: MarketProfileId;
    /**
     * `seo_analysis_snapshots.content` for the financials tab, when a
     * pre-warmed snapshot exists. Threaded through so degraded pages stay
     * crawlable — spec 2026-07-24 §7: "본문 degraded 분기에서도 섹션 유지".
     * `FinancialsSnapshotProse` itself renders `null` when the content is
     * absent/empty, so this prop is safe to pass unconditionally.
     */
    snapshotContent?: unknown;
    /** 스냅샷 행의 `generatedAt`. 프로즈 셸의 기준일 캡션에 쓴다. */
    snapshotGeneratedAt?: Date;
}

/**
 * Rendered when the FMP company profile is temporarily unavailable (infra
 * failure) on the financials route.
 *
 * `getProfileResilient` reports `degraded` and `generateMetadata` responds
 * noindex, so this is a soft, non-indexed 200 — never a 500.
 * It keeps exactly one `<h1>` (SEO) and the cross-route links so the visitor
 * can still reach other tabs while the data provider recovers.
 */
export function FinancialsDegraded({
    displayName,
    symbol,
    marketProfile,
    snapshotContent,
    snapshotGeneratedAt,
}: FinancialsDegradedProps) {
    const t = useTranslations('app.symbol');
    return (
        <SymbolDegradedShell
            heading={`${displayName} ${t('FinancialsDegraded.128c11')}`}
            noticeTitle={t('FinancialsDegraded.595d2d')}
            noticeBody={t('FinancialsDegraded.4e578a')}
            symbol={symbol}
            current="financials"
            marketProfile={marketProfile}
        >
            <FinancialsSnapshotProse
                content={snapshotContent}
                symbol={symbol}
                displayName={displayName}
                marketProfile={marketProfile}
                generatedAt={snapshotGeneratedAt}
            />
        </SymbolDegradedShell>
    );
}
