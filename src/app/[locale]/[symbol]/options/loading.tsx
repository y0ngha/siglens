'use client';

// ⚠️ `useTranslations`(서버 컴포넌트)는 요청 스코프의 로케일을 요구하는데,
// ISR 콜드 생성 시점에는 그게 없어 next-intl이 `headers()`로 폴백하고 정적 렌더가
// 중단된다 — `digest: 'DYNAMIC_SERVER_USAGE'`로 **종목 페이지 전체가 500**이었다
// (잘못된 심볼도 404 대신 500이 되어 soft 404가 재발). 클라이언트 컴포넌트는
// `NextIntlClientProvider`에서 로케일을 받으므로 요청 스코프가 필요 없다.
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';

// `mapExpirationsToSlots`가 산출하는 슬롯 6종(1W/2W/1M/2M/3M/6M)에 종합 chip을 더한 수.
const EXPIRATION_CHIP_SKELETON_COUNT = 7;
// OptionsMetricsRow의 카드 4종(Max Pain, P/C Ratio, ATM IV, Implied Move).
const METRIC_CARD_COUNT = 4;
// OptionsAiAnalysisSkeleton의 줄 분포를 그대로 따라 5줄.
const AI_ANALYSIS_LINE_WIDTHS = [
    'w-full',
    'w-[92%]',
    'w-4/5',
    'w-3/5',
    'w-2/3',
] as const;
// OptionsAiAnalysis 카드 안 '만기별 해석' 리스트 자리. 실제 평균 만기 수 3개.
const AI_PER_EXPIRATION_ITEM_COUNT = 3;
// OptionsChainTable 헤더 + 5행. 실제 페이지의 표 높이에 가깝게 잡는다.
const CHAIN_TABLE_ROW_COUNT = 6;
// CrossLinkCards는 3개 (overall, fundamental, news 등) 가로 그리드.
const CROSS_LINK_CARD_COUNT = 3;

export default function OptionsLoading() {
    const t = useTranslations('app.symbol');
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-secondary-700 bg-secondary-800 p-3">
                <div className="mr-1 h-3 w-10 animate-pulse rounded bg-secondary-700" />
                {Array.from({ length: EXPIRATION_CHIP_SKELETON_COUNT }).map(
                    (_, i) => (
                        <div
                            key={i}
                            className="h-7 w-20 animate-pulse rounded-full bg-secondary-700"
                        />
                    )
                )}
            </div>

            <section
                className="rounded-xl border border-primary-500/30 bg-gradient-to-br from-secondary-800 to-secondary-900 p-6 ring-1 ring-primary-500/10"
                aria-busy="true"
                aria-label={t('loading.673e73')}
            >
                <div className="mb-4 flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                    <div className="h-4 w-32 animate-pulse rounded bg-secondary-700" />
                </div>
                <div className="mb-5 space-y-2">
                    {AI_ANALYSIS_LINE_WIDTHS.map(w => (
                        <div
                            key={w}
                            className={cn(
                                'bg-secondary-700 h-3 animate-pulse rounded',
                                w
                            )}
                        />
                    ))}
                </div>
                <div className="mb-3 h-3 w-24 animate-pulse rounded bg-secondary-700" />
                <ul className="space-y-3">
                    {Array.from({ length: AI_PER_EXPIRATION_ITEM_COUNT }).map(
                        (_, i) => (
                            <li
                                key={i}
                                className="rounded-lg border border-secondary-700 p-3"
                            >
                                <div className="mb-2 h-3 w-24 animate-pulse rounded bg-secondary-700" />
                                <div className="h-3 w-full animate-pulse rounded bg-secondary-700" />
                            </li>
                        )
                    )}
                </ul>
            </section>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: METRIC_CARD_COUNT }).map((_, i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-4"
                    >
                        <div className="h-3 w-16 rounded bg-secondary-700" />
                        <div className="mt-2 h-6 w-20 rounded bg-secondary-700" />
                    </div>
                ))}
            </div>

            <div className="space-y-2 rounded-xl border border-secondary-700 bg-secondary-800 p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-secondary-700" />
                <div className="h-60 w-full animate-pulse rounded bg-secondary-700" />
                <div className="h-3 w-40 animate-pulse rounded bg-secondary-700" />
            </div>

            <div className="space-y-2 rounded-xl border border-secondary-700 bg-secondary-800 p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-secondary-700" />
                <div className="space-y-2">
                    {Array.from({ length: CHAIN_TABLE_ROW_COUNT }).map(
                        (_, i) => (
                            <div
                                key={i}
                                className="h-8 w-full animate-pulse rounded bg-secondary-700"
                            />
                        )
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Array.from({ length: CROSS_LINK_CARD_COUNT }).map((_, i) => (
                    <div
                        key={i}
                        className="h-24 w-full animate-pulse rounded-xl bg-secondary-700"
                    />
                ))}
            </div>
        </main>
    );
}
