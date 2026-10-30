/**
 * 섹터 신호 종목 카드 — 시세·신호 배지·상충 안내를 담고, 큐레이션 종목이면 종목 페이지로 링크한다.
 */
import { useTranslations } from 'next-intl';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { QuoteHeader } from './ui/quote/QuoteHeader';
import { ConflictNote } from './ui/signal/ConflictNote';
import { SignalBadgeList } from './ui/signal/SignalBadgeList';
import { signalStockHref } from './utils/signalStockLink';

interface SignalStockCardProps {
    data: StockWithConflict;
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
}

/**
 * 링크 제목은 카드에 보이는 이름과 **같은 소스**(`assetLabel`)를 쓴다 — 카드는 이름인데
 * 툴팁만 티커면 한 카드가 두 이름으로 읽힌다.
 *
 * 큐레이션 밖 종목은 링크 없는 카드다(`signalStockHref`가 `null`). 같은 시각 틀을 유지해
 * 그리드가 흔들리지 않는다.
 */
export function SignalStockCard({
    data,
    currencySymbol,
    tickerIsReadable,
}: SignalStockCardProps) {
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();
    const displayName = assetLabel(data.symbol, data.koreanName);
    const href = signalStockHref(data.symbol);
    const content = (
        <div className="flex flex-col gap-1">
            <QuoteHeader
                layout="signal"
                data={{
                    symbol: data.symbol,
                    displayName,
                    price: data.price,
                    changePercent: data.changePercent,
                }}
                currencySymbol={currencySymbol}
                tickerIsReadable={tickerIsReadable}
            />
            <SignalBadgeList signals={data.signals} />
            {data.conflict && <ConflictNote conflict={data.conflict} />}
        </div>
    );

    if (href === null) {
        return <div className={cn(SURFACE_CARD, 'block p-3')}>{content}</div>;
    }
    return (
        <Link
            href={href}
            title={t('SignalStockCard.analyzeTitle', { v0: displayName })}
            // 카드 그리드로 다수 렌더 — 기본 prefetch면 뷰포트 진입마다 RSC를 당긴다.
            prefetch={false}
            className={cn(CARD_LINK_CLASSES, 'p-3')}
        >
            {content}
        </Link>
    );
}
