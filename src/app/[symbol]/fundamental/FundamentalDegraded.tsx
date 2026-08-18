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
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>
                {displayName} 재무지표와 애널리스트 의견
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
                    재무 데이터를 일시적으로 불러올 수 없어요
                </p>
                <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                    외부 데이터 제공처가 잠시 응답하지 않고 있어요. 잠시 후 다시
                    방문하시면 PER·ROE·애널리스트 컨센서스를 보실 수 있습니다.
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
