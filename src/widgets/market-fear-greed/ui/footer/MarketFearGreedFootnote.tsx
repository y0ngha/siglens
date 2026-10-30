/**
 * 시장 공포·탐욕 페이지 하단의 산출 방식 고지와 표본 안내.
 */
import { useTranslations } from 'next-intl';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import type { SnapshotConfidence } from '@/shared/lib/types';
import { SampleFooterText } from '@/shared/ui/SampleFooterText';

/**
 * 시장별 고지 문구 키(`widgets.market-fear-greed.page`). 시장마다 지수를 따로
 * 산출하므로 독자가 견줘 볼 법한 기준 지수와의 차이를 각자 밝힌다.
 * - us: CNN Fear & Greed — 7개가 아닌 5개 요인(풋/콜·NYSE 52주 신고가/신저가는 데이터 소스가 없다).
 * - kr: 널리 인용되는 기준 지수가 없어 국내 대체 입력을 설명한다.
 * - crypto: alternative.me — 소셜·설문 입력 없이 가격·거래대금만 쓴다.
 */
const MARKET_DIFFERENCE_KEY = {
    us: 'cnnDifference',
    kr: 'krDifference',
    crypto: 'cryptoDifference',
} as const satisfies Record<FearGreedMarketId, string>;

interface MarketFearGreedFootnoteProps {
    /** 어느 시장의 고지를 낼지. */
    market: FearGreedMarketId;
    /** 표본 안내 문장의 분기(정상·제한). */
    confidence: SnapshotConfidence;
    /** 점수를 매기는 데 쓴 거래일 수. */
    sampleSize: number;
}

/** 산출 방식 고지 한 단락과 표본 안내 한 단락. */
export function MarketFearGreedFootnote({
    market,
    confidence,
    sampleSize,
}: MarketFearGreedFootnoteProps) {
    const tPage = useTranslations('widgets.market-fear-greed.page');
    return (
        <footer className="flex flex-col gap-1 text-xs text-secondary-500">
            <p>{tPage(MARKET_DIFFERENCE_KEY[market])}</p>
            <p>
                <SampleFooterText
                    confidence={confidence}
                    sampleSize={sampleSize}
                />
            </p>
        </footer>
    );
}
