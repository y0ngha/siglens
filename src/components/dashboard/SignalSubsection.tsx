import type { StockSignalResult } from '@/domain/signals/types';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    title: string;
    marker: string; // ▲ ▼ △ ▽
    variant: 'confirmed' | 'expected';
    stocks: readonly StockSignalResult[];
}

export function SignalSubsection({
    title,
    marker,
    variant,
    stocks,
}: SignalSubsectionProps) {
    const count = stocks.length.toString().padStart(2, '0');
    const borderClass =
        variant === 'confirmed'
            ? 'border-t-2 border-secondary-600'
            : 'border-t border-dashed border-secondary-700';
    const labelOpacity =
        variant === 'confirmed' ? 'opacity-100 font-semibold' : 'opacity-70 font-medium';

    return (
        <section className={`${borderClass} pt-3 pb-4`}>
            <div className="mb-3 flex items-baseline justify-between">
                <h3
                    className={`text-secondary-200 text-pretty text-sm tracking-[0.15em] uppercase ${labelOpacity}`}
                >
                    <span aria-hidden="true" className="mr-2">{marker}</span>
                    {title}
                </h3>
                <span
                    className="text-secondary-500 font-mono text-2xl tabular-nums"
                    aria-label={`${stocks.length}개 종목`}
                >
                    {count}
                </span>
            </div>
            {stocks.length === 0 ? (
                <p
                    className="text-secondary-500 py-4 text-center text-xs italic"
                    role="status"
                >
                    오늘은 해당 신호가 없습니다. 다른 섹터를 확인해 보세요.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {stocks.map(stock => (
                        <SignalStockCard key={stock.symbol} data={stock} />
                    ))}
                </div>
            )}
        </section>
    );
}
