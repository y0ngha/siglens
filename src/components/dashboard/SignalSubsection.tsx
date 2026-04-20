import type { StockSignalResult } from '@/domain/types';
import { cn } from '@/lib/cn';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    title: string;
    marker: string;
    variant: 'confirmed' | 'expected' | 'mixed';
    stocks: readonly StockSignalResult[];
    infoMessage?: string;
}

export function SignalSubsection({
    title,
    marker,
    variant,
    stocks,
    infoMessage,
}: SignalSubsectionProps) {
    const count = stocks.length.toString().padStart(2, '0');
    const borderClass =
        variant === 'confirmed'
            ? 'border-t-2 border-secondary-600'
            : variant === 'mixed'
              ? 'border-t-2 border-secondary-500'
              : 'border-t border-dashed border-secondary-700';
    const labelOpacity =
        variant === 'confirmed' || variant === 'mixed'
            ? 'opacity-100 font-semibold'
            : 'opacity-70 font-medium';

    return (
        <section className={cn(borderClass, 'pt-3 pb-4')}>
            <div className="mb-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <h3
                        className={cn(
                            'text-secondary-200 text-sm tracking-[0.15em] text-pretty uppercase',
                            labelOpacity
                        )}
                    >
                        <span aria-hidden="true" className="mr-2">
                            {marker}
                        </span>
                        {title}
                    </h3>
                    {infoMessage && (
                        <button
                            type="button"
                            title={infoMessage}
                            aria-label={infoMessage}
                            className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-secondary-500 cursor-default rounded text-xs transition-colors focus:outline-none focus-visible:ring-2"
                        >
                            ⓘ
                        </button>
                    )}
                </div>
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
