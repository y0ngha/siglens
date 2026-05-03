// Profile + Valuation + Peers + Profitability + Growth + FinancialHealth = 6 sections.
const SKELETON_SECTION_COUNT = 6;

export default function FundamentalLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            {[...Array(SKELETON_SECTION_COUNT)].map((_, i) => (
                <div
                    key={i}
                    className="bg-secondary-700 h-32 animate-pulse rounded-xl"
                    aria-hidden="true"
                />
            ))}
        </main>
    );
}
