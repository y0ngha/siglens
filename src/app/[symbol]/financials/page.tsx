import { getFinancialsPageData } from '@/app/[symbol]/financials/financialData';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { FinancialsDegraded } from './FinancialsDegraded';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { FinancialsStatements } from '@/widgets/financials/FinancialsStatements';
import { CrossLinkCards, SymbolPageHeading } from '@/widgets/symbol-page';
import {
    VALID_TICKER_RE,
    type SymbolRouteParams,
} from '@/shared/config/market';
import { notFound } from 'next/navigation';

// 종목당 재무제표는 분기(약 45일) 단위로 갱신된다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 다음 분기 공시 이전에 오래된 데이터를 서빙하지 않는 균형점이다.
// MISTAKES §15: route segment config must be a literal constant, not an imported value.
export const revalidate = 86400; // 24h

// generateStaticParams가 없으면 revalidate가 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild
// 없이, 첫 요청에 렌더+캐시 후 revalidate 주기로 재생성하는 on-demand ISR.
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function FinancialsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // Gate via profile — same pattern as the fundamental page.
    // getProfileResilient uses ['fundamental:profile', upper] key, shared with
    // ProfileSection inside the fundamental page, so there is no extra FMP round-trip.
    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);

    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다.
    if (profileDegraded) {
        return <FinancialsDegraded displayName={upper} symbol={upper} />;
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // Fetch the annual snapshot + scorecard in a single call.
    const { snapshot, scorecard } = await getFinancialsPageData(upper);

    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            {/* Visible h1 — one per page, SEO contract (matches fundamental page pattern) */}
            <SymbolPageHeading>{upper} 재무제표</SymbolPageHeading>

            {/* Scorecard hero — SSR-only, always annual */}
            <FinancialsScorecard scorecard={scorecard} />

            {/*
             * Phase 5 placeholder: <FinancialsAiSummary symbol={upper} />
             * Not imported yet — component does not exist.
             */}

            {/* Statement sections with annual/quarter toggle (client-driven) */}
            <FinancialsStatements symbol={upper} annualSnapshot={snapshot} />

            <CrossLinkCards symbol={upper} current="financials" />
        </main>
    );
}
