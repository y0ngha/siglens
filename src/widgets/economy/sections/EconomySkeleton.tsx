import {
    ECONOMY_INDICATOR_CATEGORIES,
    ECONOMY_INDICATORS,
    type EconomyCategoryKey,
} from '@/shared/config/economyIndicators';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';

/** 카드 수 계산에 필요한 최소 형태 — 미국·한국 레지스트리가 공유하는 부분. */
interface CategorizedIndicator {
    readonly category: EconomyCategoryKey;
}

/**
 * 카테고리별 카드 수를 **레지스트리에서 파생**한다. 숫자를 손으로 적어 두면 지표가
 * 늘거나 줄 때 스켈레톤만 옛 모양으로 남아, 정확히 이 파일이 고치려는 레이아웃
 * 이동을 다시 만든다.
 *
 * ⚠️ 결과는 **상한이지 정확한 개수가 아니다.** 실제 그리드는 값이 없는 지표
 * (`series.latest === null`), 국채 스냅샷 부재, 카드가 0장인 카테고리를 각각
 * 걸러 내거나 통째로 `null`을 반환한다. FRED 부분 장애처럼 데이터가 덜 찬 날에는
 * 자리표가 실제보다 크게 잡히고, 그만큼 아래가 위로 당겨진다. 자리표의 본질적
 * 한계이므로 없애지 못하고, 대신 여기 적어 다음 사람이 개수를 정확한 값으로
 * 오해하지 않게 한다.
 */
function deriveCategories(
    indicators: readonly CategorizedIndicator[],
    treasuryCardCount: number
) {
    return ECONOMY_INDICATOR_CATEGORIES.map(cat => ({
        key: cat.key,
        cardCount:
            indicators.filter(m => m.category === cat.key).length +
            (cat.key === 'rates' ? treasuryCardCount : 0),
    }));
}

/** 어느 경제 화면의 자리를 잡는지. 화면마다 그리드 구성과 간격이 다르다. */
export type EconomySkeletonVariant = 'us' | 'kr';

/**
 * 변형별 기하 — **실제 그리드와 한 곳에서 맞춘다.**
 *
 * `/economy`는 `EconomicIndicatorGrid`(space-y-8, h2 text-lg, h3 text-base, 국채 3장),
 * `/economy/kr`은 `KrEconomicIndicatorGrid`(space-y-5, h2 text-base, h3 text-sm,
 * 국채 없음)를 렌더하고 거시 요약·브리핑 카드도 없다. 예전에는 미국 형상 하나만
 * 있어서 한국 화면이 카드 2장분 + 거시 카드 2개분을 과하게 예약했다.
 */
const VARIANTS = {
    us: {
        indicators: ECONOMY_INDICATORS as readonly CategorizedIndicator[],
        treasuryCardCount: 3,
        showMacroSections: true,
        sectionGap: 'space-y-8',
        headingBlock: 'h-7 w-24',
        categoryHeading: 'mb-3 h-6 w-20',
    },
    kr: {
        indicators: KR_ECONOMY_INDICATORS as readonly CategorizedIndicator[],
        treasuryCardCount: 0,
        showMacroSections: false,
        sectionGap: 'space-y-5',
        headingBlock: 'h-6 w-24',
        categoryHeading: 'mb-2 h-5 w-20',
    },
} as const satisfies Record<EconomySkeletonVariant, unknown>;

export interface EconomySkeletonProps {
    /** 기본값 `'us'` — `/economy/kr`은 반드시 `'kr'`을 넘긴다. */
    readonly variant?: EconomySkeletonVariant;
}

/** 실제 `IndicatorCard`(article.p-4: 라벨 / 값 / 델타 배지 / 날짜)와 같은 높이의 자리표. */
function SkeletonIndicatorCard() {
    return (
        <div className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-4 motion-reduce:animate-none">
            <div className="mb-2 h-5 w-24 rounded bg-secondary-700" />
            <div className="h-8 w-20 rounded bg-secondary-700" />
            <div className="mt-1 h-5 w-16 rounded bg-secondary-700" />
            <div className="mt-1 h-4 w-20 rounded bg-secondary-700" />
        </div>
    );
}

/**
 * Streaming / cold-gen Suspense fallback for EconomyContent.
 *
 * Mirrors the rough visual structure of EconomyContent:
 *   1. Macro-facts section — an SSR text proxy visible to crawlers in the real
 *      component. We need a height placeholder so the layout doesn't shift on
 *      hydration when EconomyContent resolves.
 *   2. MacroBriefing card — matches MacroBriefingSkeleton dimensions.
 *   3. Indicator grid — `EconomicIndicatorGrid`와 **같은 골격**(h2 → 카테고리마다
 *      h3 + 1/2/3열 카드 그리드)으로 그린다. 예전에는 "2열에 큰 카드 4장"이라는
 *      전혀 다른 모양이어서, 실제 그리드(카드 12장 = 금리 4·물가 2·성장 3·고용 3)로
 *      교체되는 순간 아래 콘텐츠가 통째로 밀렸다 — Lighthouse 모바일에서 이 섹션
 *      하나가 CLS 0.170을 만들어 페이지 전체를 0.224(Needs work)로 끌어올렸다.
 *   4. Economic calendar placeholder.
 *
 * All pulse blocks use the project's standard:
 *   `border-secondary-700 bg-secondary-800 rounded-xl border p-6 animate-pulse
 *    motion-reduce:animate-none`
 *
 * Pure presentational — no 'use client', no data dependencies.
 */
export function EconomySkeleton({ variant = 'us' }: EconomySkeletonProps = {}) {
    const v = VARIANTS[variant];
    const categories = deriveCategories(v.indicators, v.treasuryCardCount);
    return (
        <div
            className="space-y-6"
            role="status"
            aria-label="경제 지표 로딩 중"
            aria-busy="true"
        >
            {v.showMacroSections && (
                <>
                    <section
                        className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                        aria-hidden="true"
                    >
                        <div className="mb-3 h-6 w-36 rounded bg-secondary-700" />
                        <div className="h-4 w-full rounded bg-secondary-700" />
                    </section>

                    <section
                        className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                        aria-hidden="true"
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="h-6 w-28 rounded bg-secondary-700" />
                            <div className="h-5 w-14 rounded bg-secondary-700" />
                        </div>
                        <div className="mb-2 h-4 w-full rounded bg-secondary-700" />
                        <div className="mb-2 h-4 w-5/6 rounded bg-secondary-700" />
                        <div className="h-4 w-4/5 rounded bg-secondary-700" />
                    </section>
                </>
            )}

            {/* 실제 그리드와 동일 골격 — section > h2 + 카테고리별 (h3 + 카드 그리드) */}
            <section className={v.sectionGap} aria-hidden="true">
                <div
                    className={`${v.headingBlock} animate-pulse rounded bg-secondary-700 motion-reduce:animate-none`}
                />
                {categories.map(cat => (
                    <div key={cat.key}>
                        <div
                            className={`${v.categoryHeading} animate-pulse rounded bg-secondary-700 motion-reduce:animate-none`}
                        />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: cat.cardCount }).map(
                                (_, j) => (
                                    <SkeletonIndicatorCard key={j} />
                                )
                            )}
                        </div>
                    </div>
                ))}
            </section>

            <section
                className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="mb-4 h-5 w-32 rounded bg-secondary-700" />
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 rounded bg-secondary-700/60 p-3"
                        >
                            <div className="h-4 w-20 rounded bg-secondary-700" />
                            <div className="h-4 w-40 rounded bg-secondary-700" />
                            <div className="ml-auto h-4 w-12 rounded bg-secondary-700" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
