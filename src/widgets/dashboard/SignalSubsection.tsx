import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    /** 가격 앞에 붙일 통화 기호. 시장마다 다르다(`DashboardScope.currencySymbol`). */
    currencySymbol: string;
    /** 티커를 주 제목으로 쓸지(`DashboardScope.tickerIsReadable`). */
    tickerIsReadable: boolean;
    title: string;
    marker: string; // ▲ ▼ △ ▽ ◈
    variant: 'confirmed' | 'expected' | 'mixed';
    stocks: readonly StockWithConflict[];
    infoMessage?: ReactNode;
}

const VARIANT_BORDER: Record<SignalSubsectionProps['variant'], string> = {
    confirmed: 'border-t-2 border-secondary-600',
    mixed: 'border-t-2 border-secondary-500',
    expected: 'border-t border-dashed border-secondary-700',
};

const VARIANT_LABEL: Record<SignalSubsectionProps['variant'], string> = {
    confirmed: 'opacity-100 font-semibold',
    mixed: 'opacity-100 font-semibold',
    expected: 'opacity-70 font-medium',
};

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
    const count = stocks.length.toString().padStart(2, '0');

    return (
        <section className={cn(VARIANT_BORDER[variant], 'pt-3 pb-4')}>
            <div className="mb-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <h3
                        className={cn(
                            'text-secondary-200 text-sm tracking-[0.15em] text-pretty uppercase',
                            VARIANT_LABEL[variant]
                        )}
                    >
                        <span aria-hidden="true" className="mr-2">
                            {marker}
                        </span>
                        {title}
                    </h3>
                    {infoMessage !== undefined && infoMessage !== null && (
                        <InfoTooltip>
                            <div className="text-secondary-300">
                                {infoMessage}
                            </div>
                        </InfoTooltip>
                    )}
                </div>
                <span
                    className="font-mono text-2xl text-secondary-500 tabular-nums"
                    aria-label={t('SignalSubsection.tickerCount', {
                        v0: stocks.length,
                    })}
                >
                    {count}
                </span>
            </div>
            {stocks.length === 0 ? (
                <p
                    className="py-4 text-center text-xs text-secondary-500 italic"
                    role="status"
                >
                    {t('SignalSubsection.fe9464')}
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
