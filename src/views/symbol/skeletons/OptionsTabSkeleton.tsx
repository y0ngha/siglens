'use client';

// ⚠️ 클라이언트 컴포넌트로 둔다. 서버 `useTranslations`는 요청 스코프의 로케일을 요구하는데
// ISR 콜드 생성 시점에는 그게 없어 next-intl이 `headers()`로 폴백하고 정적 렌더가
// `DYNAMIC_SERVER_USAGE`로 중단된다(종목 페이지 전체가 500). 클라이언트 컴포넌트는
// `NextIntlClientProvider`에서 로케일을 받으므로 요청 스코프가 필요 없다.
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';

// `mapExpirationsToSlots`가 산출하는 슬롯 최대 6종(1W/2W/1M/2M/3M/6M — 만기가 없으면
// chip 생략)에 종합 chip을 더한 수.
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

/**
 * 옵션 탭으로 이동하는 동안 `SymbolTabSkeleton`이 그리는 골격. 옵션 탭 본문은 섹션 카드의 세로 목록이
 * 아니라(만기 칩·지표 카드·체인 표) `SectionSkeleton` 묶음 대신 본문 구조를 그대로 따른다.
 */
export function OptionsTabSkeleton() {
    const t = useTranslations('app.symbol');
    return (
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
            <div
                className={cn(
                    SURFACE_CARD,
                    'flex flex-wrap items-center gap-2 p-3'
                )}
            >
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
                className="rounded-lg border border-primary-500/30 bg-gradient-to-br from-secondary-800 to-secondary-900 p-6 ring-1 ring-primary-500/10"
                aria-busy="true"
                aria-label={t('loading.673e73')}
            >
                <div className="mb-4 flex items-center gap-2">
                    <Spinner size="sm" />
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
                            <li key={i} className={cn(SURFACE_NESTED, 'p-3')}>
                                {/* 중첩 블록이 이미 700 틴트라 700 막대는 묻힌다 — 한 단계 진한 600. */}
                                <div className="mb-2 h-3 w-24 animate-pulse rounded bg-secondary-600" />
                                <div className="h-3 w-full animate-pulse rounded bg-secondary-600" />
                            </li>
                        )
                    )}
                </ul>
            </section>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: METRIC_CARD_COUNT }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(SURFACE_CARD, 'animate-pulse p-4')}
                    >
                        <div className="h-3 w-16 rounded bg-secondary-700" />
                        <div className="mt-2 h-6 w-20 rounded bg-secondary-700" />
                    </div>
                ))}
            </div>

            <div className={cn(SURFACE_CARD, 'space-y-2 p-4')}>
                <div className="h-4 w-48 animate-pulse rounded bg-secondary-700" />
                <div className="h-60 w-full animate-pulse rounded bg-secondary-700" />
                <div className="h-3 w-40 animate-pulse rounded bg-secondary-700" />
            </div>

            <div className={cn(SURFACE_CARD, 'space-y-2 p-4')}>
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
                        className="h-24 w-full animate-pulse rounded-lg bg-secondary-700"
                    />
                ))}
            </div>
        </main>
    );
}
