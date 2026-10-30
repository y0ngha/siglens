/**
 * 지수·섹터 시세 카드 한 장.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import { QuoteHeader } from '../quote/QuoteHeader';

type IndexCardData = MarketIndexData | MarketSectorData;

const CARD_LAYOUT = 'flex flex-col gap-1 p-3';

interface IndexCardProps {
    data: IndexCardData;
    href?: string;
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
}

/**
 * 지수·섹터 시세 카드. `href`가 있으면 링크 카드, 없으면 정적 카드다.
 * 표시명은 심볼로 카탈로그를 다시 찾아 로케일에 맞춘다.
 */
export function IndexCard({
    data,
    href,
    currencySymbol,
    tickerIsReadable,
}: IndexCardProps) {
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();
    const displayName = assetLabel(data.symbol, data.koreanName);

    const header = (
        <QuoteHeader
            data={{
                symbol: data.symbol,
                displayName,
                price: data.price,
                changePercent: data.changesPercentage,
            }}
            currencySymbol={currencySymbol}
            tickerIsReadable={tickerIsReadable}
        />
    );

    if (href) {
        return (
            <Link
                href={href}
                // 표시명과 **같은 소스**를 써야 한다. 카드는 로케일화된 이름인데 툴팁만
                // 다른 이름이면 한 카드가 두 이름으로 읽힌다.
                title={t('IndexCard.analyzeTitle', {
                    v0: displayName,
                })}
                // 카드 그리드로 다수 렌더 — 기본 prefetch면 뷰포트 진입마다 RSC를 당긴다.
                prefetch={false}
                // 면과 호버가 한 상수(`CARD_LINK_CLASSES`)라 링크 자신이 카드 면이다.
                className={cn(CARD_LINK_CLASSES, CARD_LAYOUT)}
            >
                {header}
            </Link>
        );
    }

    return <div className={cn(SURFACE_CARD, CARD_LAYOUT)}>{header}</div>;
}
