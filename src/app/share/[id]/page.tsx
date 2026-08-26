import type { Metadata } from 'next';
import Link from 'next/link';
import { getCachedSharedAnalysis } from '@/entities/shared-analysis/actions/getCachedSharedAnalysis';
import { resolveAsOf } from '@/entities/shared-analysis/lib/resolveAsOf';
import { kindLabel } from '@/widgets/share';
import { buildShareMetadata } from '@/entities/shared-analysis/lib/buildShareSeo';
import { ShareKindPanel } from '@/views/share';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { SITE_NAME } from '@/shared/lib/seo';
import { INVESTMENT_DISCLAIMER } from '@/shared/lib/legal';

// 공유 스냅샷은 id별로 달라 정적 생성 불가 → force-dynamic
export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const lookup = await getCachedSharedAnalysis(id);
    return buildShareMetadata(lookup, id);
}

export default async function SharePage({ params }: Props) {
    const { id } = await params;
    const lookup = await getCachedSharedAnalysis(id);

    if (lookup.status !== 'found') {
        // Intentional: returns HTTP 200 (not notFound()) so the user sees a
        // friendly expired-link page instead of a generic 404. The noindex
        // metadata in buildShareMetadata() prevents search engines from
        // indexing this expired/not-found state.
        return (
            <main className="page-container flex flex-1 flex-col items-center py-20 text-center">
                <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                    공유 링크 만료
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-50 sm:text-3xl">
                    이 공유 링크는 만료됐어요
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    공유된 분석 스냅샷의 유효 기간이 지났거나 존재하지 않는
                    링크입니다. {SITE_NAME}에서 최신 분석을 직접 확인하세요.
                </p>
                <Link
                    href="/"
                    className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {SITE_NAME} 홈으로 돌아가기
                </Link>
            </main>
        );
    }

    const { snapshot, createdAt } = lookup;
    const ticker = snapshot.symbol.toUpperCase();
    const asOf = formatKoreanDateTime(resolveAsOf(snapshot, createdAt));
    const label = kindLabel(snapshot.kind);
    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
            {/* 이 h1에는 텍스트 스타일이 없다 — 의도된 것이다. 직접 텍스트 노드가
                없고 네 개의 자식 span이 각자 크기·굵기·색을 갖는 브레드크럼 형태라
                (SIGLENS / TICKER [종류]), 상속색은 화면에 나타나지 않는다.
                "색 클래스 없는 heading" 스캐너가 이 줄을 반복해서 잡는데, 그 판정
                기준은 **직접 텍스트를 가진 heading**에만 적용된다. 여기에 색을 얹으면
                아무 데도 안 쓰이는 죽은 클래스가 된다. */}
            <h1 className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary-500">
                    {SITE_NAME}
                </span>
                <span className="text-sm text-secondary-500">/</span>
                <span className="text-xl font-bold text-secondary-100">
                    {ticker}
                </span>
                <span className="rounded bg-primary-900/40 px-2 py-0.5 text-xs font-semibold text-primary-300">
                    {label}
                </span>
            </h1>

            <div className="mb-6 rounded-lg border border-secondary-700 bg-secondary-800/50 px-3 py-2 text-xs text-secondary-400">
                {asOf} 데이터라서 현재 시세와 다를 수 있어요
            </div>

            <ShareKindPanel
                kind={snapshot.kind}
                result={snapshot.result}
                chartBars={snapshot.chartBars}
                assetClass={
                    snapshot.context.assetClass === 'crypto'
                        ? 'crypto'
                        : 'equity'
                }
                symbol={ticker}
            />

            <div
                role="note"
                aria-label="투자 면책 고지"
                className="mt-8 rounded-lg border border-ui-danger/30 bg-ui-danger/5 px-4 py-3"
            >
                <p className="text-xs leading-relaxed text-secondary-400">
                    {INVESTMENT_DISCLAIMER}
                </p>
            </div>

            <div className="mt-8 text-center">
                <Link
                    href={`/${ticker}`}
                    className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {SITE_NAME}에서 {ticker} 직접 분석하기
                </Link>
            </div>
        </main>
    );
}
