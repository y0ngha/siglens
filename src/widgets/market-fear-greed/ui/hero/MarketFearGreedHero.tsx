/**
 * 시장 공포·탐욕 페이지 상단의 대형 게이지와 기준 세션 날짜.
 */
import { useTranslations } from 'next-intl';
import type { MarketFearGreedViewSnapshot } from '@/entities/market-fear-greed/model';
import { FearGreedGauge } from '@/shared/ui/FearGreedGauge';
import { isoDateParts } from '../../utils/isoDateParts';

interface MarketFearGreedHeroProps {
    /** 최신 판독값. 점수·라벨·신뢰도·기준일을 읽는다. */
    snapshot: MarketFearGreedViewSnapshot;
}

/** 현재 점수 게이지와 "YYYY년 M월 D일 종가 기준" 한 줄. */
export function MarketFearGreedHero({ snapshot }: MarketFearGreedHeroProps) {
    const tPage = useTranslations('widgets.market-fear-greed.page');
    const { year, month, day } = isoDateParts(snapshot.asOf);
    return (
        <section className="flex flex-col items-center gap-2">
            <FearGreedGauge
                score={Math.round(snapshot.score)}
                label={snapshot.label}
                size="hero"
                confidence={snapshot.confidence}
            />
            <p className="text-xs text-secondary-500">
                {tPage('asOfClose', { v0: year, v1: month, v2: day })}
            </p>
        </section>
    );
}
