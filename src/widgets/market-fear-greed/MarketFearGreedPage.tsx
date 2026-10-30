/**
 * 시장(미국·한국·암호화폐) 공포·탐욕 지수 위젯의 조합 컴포넌트.
 */
import { useTranslations } from 'next-intl';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { MarketFearGreedComparison } from './ui/comparison/MarketFearGreedComparison';
import { MarketFearGreedEmptyState } from './ui/empty/MarketFearGreedEmptyState';
import { MarketFearGreedFactorBar } from './ui/factors/MarketFearGreedFactorBar';
import { MarketFearGreedFootnote } from './ui/footer/MarketFearGreedFootnote';
import { MarketFearGreedHero } from './ui/hero/MarketFearGreedHero';

interface MarketFearGreedPageProps {
    /** 미국·한국(`MarketFearGreedSnapshot`)과 암호화폐 스냅샷을 모두 받는다 — 요인은 스냅샷 자신의 것을 그린다. */
    view: MarketFearGreedView<MarketFearGreedViewSnapshot>;
    /** 어느 시장의 지수인가. 요인 라벨·설명과 면책 문구가 시장마다 다르다. */
    market: FearGreedMarketId;
}

/**
 * 시장 공포·탐욕 페이지 본문. 서버 컴포넌트 — 스냅샷은 서버에서 미리 계산돼
 * 오므로(봉 fetch·클라이언트 재계산 없음) 종목 탭 `FearGreedPage`와 달리
 * 하이드레이션 시점 문제가 없다.
 */
export function MarketFearGreedPage({
    view,
    market,
}: MarketFearGreedPageProps) {
    const t = useTranslations('widgets.market-fear-greed');
    const { snapshot, comparisons } = view;

    if (!snapshot) return <MarketFearGreedEmptyState />;

    return (
        // 가로 여백은 라우트가 소유한다 — 이 위젯은 세로 리듬만 책임진다.
        // (여기서 좌우 padding을 또 주면 페이지 프로즈와 들여쓰기가 어긋난다.)
        <div className="flex flex-col gap-6 py-6">
            <MarketFearGreedHero snapshot={snapshot} />

            <section className="flex flex-col gap-3">
                <h2 className={HEADING_SECTION}>
                    {t('MarketFearGreedPage.41205a')}
                </h2>
                <MarketFearGreedComparison comparisons={comparisons} />
            </section>

            <section className="flex flex-col gap-3">
                <h2 className={HEADING_SECTION}>
                    {t('MarketFearGreedPage.c099fa')}
                </h2>
                {snapshot.factors.map(factor => (
                    <MarketFearGreedFactorBar
                        key={factor.key}
                        factor={factor}
                        market={market}
                    />
                ))}
            </section>

            <MarketFearGreedFootnote
                market={market}
                confidence={snapshot.confidence}
                sampleSize={snapshot.sampleSize}
            />
        </div>
    );
}
