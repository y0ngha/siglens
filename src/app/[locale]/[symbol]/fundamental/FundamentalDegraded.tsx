import { useTranslations } from 'next-intl';
import { SymbolPageHeading } from '@/views/symbol';
import { FundamentalSnapshotProse } from '@/views/symbol/snapshot/renderers/FundamentalSnapshotProse';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import type { MarketProfileId } from '@/shared/config/marketProfile';

interface FundamentalDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
    /**
     * Required (no default here, unlike `CrossLinkCards`'s own prop) — this
     * component has exactly one caller (`fundamental/page.tsx`), which always
     * has the value in hand, so there is no safe default to fall back to.
     * Threading it through prevents the same bug `CrossLinkCards`'s default
     * caused: fundamental renders for both us-equity and kr-equity, so an
     * omitted/wrong value would link Korean symbols to nonexistent
     * `/options`/`/congress` tabs (SEO audit 2026-08-18).
     */
    marketProfile: MarketProfileId;
    /**
     * `seo_analysis_snapshots.content` for the fundamental tab, when a pre-warmed
     * snapshot exists. Threaded through so degraded pages stay crawlable — spec
     * 2026-07-24 §7: "본문 degraded 분기에서도 섹션 유지". `FundamentalSnapshotProse`
     * itself renders `null` when the content is absent/empty, so this prop is
     * safe to pass unconditionally.
     */
    snapshotContent?: unknown;
    /** 스냅샷 행의 `generatedAt`. 프로즈 셸의 기준일 캡션에 쓴다. */
    snapshotGeneratedAt?: Date;
}

/**
 * Rendered when the FMP company profile is temporarily unavailable (infra
 * failure) on the fundamental route.
 *
 * `getProfileResilient` reports `degraded` and `generateMetadata` responds
 * noindex, so this is a soft, non-indexed 200 — never a 500. It keeps exactly
 * one `<h1>` (SEO) and the cross-route links, so the visitor can still reach the
 * other tabs while the data provider recovers (the next ISR revalidate /
 * on-demand invalidation restores the real content automatically).
 */
export function FundamentalDegraded({
    displayName,
    symbol,
    marketProfile,
    snapshotContent,
    snapshotGeneratedAt,
}: FundamentalDegradedProps) {
    const t = useTranslations('app.symbol');
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>
                {t('FundamentalDegraded.9e0659', { v0: displayName })}
            </SymbolPageHeading>
            <FundamentalSnapshotProse
                content={snapshotContent}
                symbol={symbol}
                displayName={displayName}
                marketProfile={marketProfile}
                generatedAt={snapshotGeneratedAt}
            />
            <section className="rounded-lg border border-secondary-800 bg-secondary-900/40 px-5 py-8 text-center">
                <p className="text-sm font-medium text-secondary-200">
                    {t('FundamentalDegraded.595d2d')}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                    {t('FundamentalDegraded.a37ac2')}
                </p>
            </section>
            <CrossLinkCards
                symbol={symbol}
                current="fundamental"
                marketProfile={marketProfile}
            />
        </main>
    );
}
