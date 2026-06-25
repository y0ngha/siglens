import Link from 'next/link';
import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';
import { cn } from '@/shared/lib/cn';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import { SignalBadge } from './SignalBadge';
import { QuoteHeader } from './QuoteHeader';

interface SignalStockCardProps {
    data: StockWithConflict;
}

export function SignalStockCard({ data }: SignalStockCardProps) {
    return (
        <Link
            href={`/${data.symbol}`}
            title={`${data.koreanName} 분석`}
            className={cn(
                'border-secondary-700 bg-secondary-800/50 border p-3',
                CARD_LINK_CLASSES
            )}
        >
            <div className="flex flex-col gap-1">
                <QuoteHeader
                    layout="signal"
                    data={{
                        symbol: data.symbol,
                        koreanName: data.koreanName,
                        price: data.price,
                        changePercent: data.changePercent,
                    }}
                />
                {data.signals.length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
                        {data.signals.map((s, i) => (
                            <span key={`${s.type}-${i}`} className="contents">
                                {i > 0 && (
                                    <span
                                        className="text-secondary-600"
                                        aria-hidden="true"
                                    >
                                        ·
                                    </span>
                                )}
                                <SignalBadge type={s.type} />
                            </span>
                        ))}
                    </div>
                )}
                {data.conflict && (
                    <p className="text-secondary-500 mt-1 text-xs">
                        상승 {data.conflict.bullishCount}건 / 하락{' '}
                        {data.conflict.bearishCount}건 감지
                    </p>
                )}
            </div>
        </Link>
    );
}
