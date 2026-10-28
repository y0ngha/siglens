/**
 * 신호 소절 하나 — 머리줄과 종목 카드 그리드(또는 빈 안내)를 조립한다.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SignalStockCard } from './SignalStockCard';
import { SubsectionHeader } from './ui/signal/SubsectionHeader';
import { SIGNAL_CARD_GRID_CLASS } from './utils/signalCardGrid';
import {
    VARIANT_BORDER,
    type SignalSubsectionVariant,
} from './utils/subsectionStyles';

interface SignalSubsectionProps {
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
    title: string;
    marker: string; // ▲ ▼ △ ▽ ◈
    variant: SignalSubsectionVariant;
    stocks: readonly StockWithConflict[];
    infoMessage?: ReactNode;
}

/**
 * 종목이 없으면 카드 대신 한 줄 안내를 보여 소절 자리를 유지한다. 이 안내는 live region이
 * 아니다 — 다섯 소절이 한꺼번에 바뀔 때 되풀이 낭독되지 않도록, 낭독은 패널의 상태 줄이 맡는다.
 */
export function SignalSubsection({
    currencySymbol,
    tickerIsReadable,
    title,
    marker,
    variant,
    stocks,
    infoMessage,
}: SignalSubsectionProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <section className={cn(VARIANT_BORDER[variant], 'pt-3 pb-4')}>
            <SubsectionHeader
                title={title}
                marker={marker}
                variant={variant}
                count={stocks.length}
                infoMessage={infoMessage}
            />
            {stocks.length === 0 ? (
                <p className="py-4 text-center text-xs text-secondary-500 italic">
                    {t('SignalSubsection.48f780')}
                </p>
            ) : (
                <div className={SIGNAL_CARD_GRID_CLASS}>
                    {stocks.map(stock => (
                        <SignalStockCard
                            key={stock.symbol}
                            data={stock}
                            currencySymbol={currencySymbol}
                            tickerIsReadable={tickerIsReadable}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
