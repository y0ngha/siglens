'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';

interface ChartTimeframeBarProps {
    /** h1에 들어가는 종목 표시명(예: "애플, Apple Inc. (AAPL)"). */
    displayName: string;
    /** h1과 같은 행의 서버 렌더 배지. 없으면 자리도 잡지 않는다. */
    headingBadge?: ReactNode;
    /** 셀렉터에 보여줄 타임프레임(클릭 즉시 바뀐다). */
    timeframe: Timeframe;
    onTimeframeChange: (next: Timeframe) => void;
    isFreeTier: boolean;
    isTierHydrated: boolean;
    /** 모바일 분석 시트를 FULL로 연다. */
    onOpenAnalysisSheet: () => void;
}

/**
 * 차트 탭 상단 한 줄 — 페이지 h1과 타임프레임 셀렉터(모바일은 "AI 분석 보기" 버튼도).
 *
 * 이 바는 아래 차트/AI 레일 2-pane에 정렬한다 — 자기가 제어하는 대상이 그쪽이다. `px-4`면 h1은
 * 캔버스 좌단에서 16px, 셀렉터 우단은 레일 우단(vw−16)과 같은 선에 놓인다. 위의 브레드크럼·탭도
 * 같은 전폭 `px-4`를 쓴다 — 두 값은 함께 움직여야 한다(`SymbolLayoutHeader`).
 *
 * h1은 차트 페이지의 유일한 가시 h1이다. 차트+AI가 첫 뷰포트를 채우는 구성이라 본문에 별도 블록을
 * 얹지 않고 이 행에 짧은 한 줄로 둔다(좁은 화면에서는 두 줄까지 감기고 sm 이상은 말줄임).
 */
export function ChartTimeframeBar({
    displayName,
    headingBadge,
    timeframe,
    onTimeframeChange,
    isFreeTier,
    isTierHydrated,
    onOpenAnalysisSheet,
}: ChartTimeframeBarProps) {
    const t = useTranslations('views.symbol');
    return (
        <div className="border-b border-secondary-700 px-4 py-2 sm:py-1.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <h1 className="line-clamp-2 min-w-0 text-sm font-semibold text-secondary-50 sm:line-clamp-none sm:truncate sm:text-base">
                        {t('chartPageHeading.heading', {
                            v0: displayName,
                        })}
                    </h1>
                    {/* 증자·희석 배지는 h1과 **같은 행**에 둔다. 모바일은 첫 뷰포트 높이를 차트 행과
                        나눠 쓰므로 따로 한 줄을 쓰면 차트가 그만큼 줄어든다. 대신 폭을 나눈다 — 배지는
                        `min-w-0`·truncate로 줄어들고(모바일 최대 절반), 전체 문구는 링크의 접근 가능한
                        이름과 `title`에 그대로 있다. */}
                    {headingBadge}
                    {/*
                     * 분석 시트를 여는 명시적 버튼(모바일 전용).
                     *
                     * 이게 없으면 시트를 여는 유일한 방법이 PEEK 띠를 잡고 드래그하는 것뿐이다.
                     * 띠 높이는 `snap − PEEK_VISIBLE_OFFSET`인데 시트는 `97svh` 고정이고 vaul은
                     * 오프셋을 `window.innerHeight`로 잡아, 모바일 툴바가 접혀 innerHeight가 svh보다
                     * 커지면 띠가 얇아지다 0에 수렴한다 — 그러면 AI 분석 패널에 접근할 수 없다.
                     * 이 버튼은 시트 밖(항상 보이는 타임프레임 바)에 있어 띠 높이와 무관하다.
                     *
                     * 세로 공간을 새로 쓰지 않도록 h1과 같은 행의 남는 폭에 둔다.
                     */}
                    <button
                        type="button"
                        onClick={onOpenAnalysisSheet}
                        className="shrink-0 touch-manipulation rounded-lg border border-border-control px-2.5 py-1 text-xs font-medium whitespace-nowrap text-secondary-300 transition-colors hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none md:hidden"
                    >
                        {t('SymbolPageClient.ddb88e')}
                    </button>
                </div>
                <TimeframeSelector
                    value={timeframe}
                    onChange={onTimeframeChange}
                    isFreeTier={isFreeTier}
                    isTierHydrated={isTierHydrated}
                />
            </div>
        </div>
    );
}
