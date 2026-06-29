import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { getSharedAnalysis } from '@/entities/shared-analysis/actions/getSharedAnalysisAction';
import { resolveAsOf } from '@/entities/shared-analysis/lib/resolveAsOf';
import { kindLabel } from '@/entities/shared-analysis/lib/kindLabel';
import { buildShareMetadata } from '@/entities/shared-analysis/lib/buildShareSeo';
import { SHARE_KIND_PANEL_REGISTRY } from '@/widgets/share/ui/kindPanelRegistry';
import { SITE_NAME } from '@/shared/lib/seo';
import { INVESTMENT_DISCLAIMER } from '@/shared/lib/legal';

// 공유 스냅샷은 id별로 달라 정적 생성 불가 → force-dynamic
export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const lookup = await getSharedAnalysis(id);
    return buildShareMetadata(lookup);
}

export default async function SharePage({ params }: Props) {
    const { id } = await params;
    const lookup = await getSharedAnalysis(id);

    if (lookup.status !== 'found') {
        return (
            <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
                <p className="text-primary-400 font-mono text-sm tracking-widest">
                    공유 링크 만료
                </p>
                <h1 className="text-secondary-100 mt-4 text-2xl font-bold sm:text-3xl">
                    이 공유 링크는 만료됐어요
                </h1>
                <p className="text-secondary-400 mt-3 max-w-md text-sm leading-relaxed">
                    공유된 분석 스냅샷의 유효 기간이 지났거나 존재하지 않는
                    링크입니다. {SITE_NAME}에서 최신 분석을 직접 확인하세요.
                </p>
                <Link
                    href="/"
                    className="bg-primary-600 hover:bg-primary-700 mt-8 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors"
                >
                    {SITE_NAME} 홈으로 돌아가기
                </Link>
            </main>
        );
    }

    const { snapshot, createdAt } = lookup;
    const ticker = snapshot.symbol.toUpperCase();
    const asOf = resolveAsOf(snapshot, createdAt);
    const label = kindLabel(snapshot.kind);
    // snapshot.kind와 snapshot.result는 같은 K에 대해 일관성을 보장하지만,
    // SharedAnalysisSnapshot<K>의 제네릭이 호출 지점에서 분기되지 않으므로
    // 런타임에는 올바른 타입이 전달됨을 보장하며 캐스트한다.
    const Panel = SHARE_KIND_PANEL_REGISTRY[snapshot.kind] as (props: {
        result: typeof snapshot.result;
    }) => React.ReactNode;

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
            {/* 헤더: 워드마크 + 종목 + 분석 종류 칩 */}
            <h1 className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-secondary-500 text-sm font-medium">
                    {SITE_NAME}
                </span>
                <span className="text-secondary-600 text-sm">/</span>
                <span className="text-secondary-100 text-lg font-bold">
                    {ticker}
                </span>
                <span className="bg-primary-900/40 text-primary-300 rounded px-2 py-0.5 text-xs font-semibold">
                    {label}
                </span>
            </h1>

            {/* 스냅샷 면책 박스 */}
            <div className="border-secondary-700 bg-secondary-800/50 text-secondary-400 mb-6 rounded-lg border px-3 py-2 text-xs">
                {asOf} 기준 · 스냅샷이라 현재 시세와 다를 수 있어요
            </div>

            {/* 분석 패널 */}
            <Panel result={snapshot.result} />

            {/* D-3: 투자 면책 고지 */}
            <div
                role="note"
                aria-label="투자 면책 고지"
                className="border-ui-danger/30 bg-ui-danger/5 mt-8 rounded-lg border px-4 py-3"
            >
                <p className="text-secondary-400 text-xs leading-relaxed">
                    {INVESTMENT_DISCLAIMER}
                </p>
            </div>

            {/* 바이럴 CTA */}
            <div className="mt-8 text-center">
                <Link
                    href={`/${ticker}`}
                    className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex items-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    {SITE_NAME}에서 {ticker} 직접 분석하기
                </Link>
            </div>
        </main>
    );
}
