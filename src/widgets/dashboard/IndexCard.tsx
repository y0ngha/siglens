import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import { QuoteHeader } from './QuoteHeader';

type IndexCardData = MarketIndexData | MarketSectorData;

interface IndexCardProps {
    data: IndexCardData;
    href?: string;
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
}

export function IndexCard({
    data,
    href,
    currencySymbol,
    tickerIsReadable,
}: IndexCardProps) {
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();

    const inner = (
        <div className="flex flex-col gap-1 rounded-lg border border-secondary-700 bg-secondary-800/50 p-3">
            <QuoteHeader
                data={{
                    symbol: data.symbol,
                    displayName: assetLabel(data.symbol, data.koreanName),
                    price: data.price,
                    changePercent: data.changesPercentage,
                }}
                currencySymbol={currencySymbol}
                tickerIsReadable={tickerIsReadable}
            />
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                // 표시명과 **같은 소스**를 써야 한다. 예전엔 `label`(core의
                // 영문명)에 한국어 `분석`을 붙여, `/ja/market`에서 카드는
                // `テクノロジー`인데 툴팁은 `Technology 분석`이었다.
                title={t('IndexCard.analyzeTitle', {
                    v0: assetLabel(data.symbol, data.koreanName),
                })}
                // 카드 그리드로 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                prefetch={false}
                className={CARD_LINK_CLASSES}
            >
                {inner}
            </Link>
        );
    }

    return inner;
}
