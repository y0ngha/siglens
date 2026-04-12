import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { CategoryId } from '@/domain/types';
import { TICKER_CATEGORIES } from '@/domain/constants/popular-tickers';

type CategoryStyle = {
    borderColor: string;
    textColor: string;
};

const CATEGORY_STYLES: Record<CategoryId, CategoryStyle> = {
    megacap: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    'ai-semiconductor': {
        borderColor: 'border-l-chart-bullish',
        textColor: 'text-chart-bullish',
    },
    'software-cloud': {
        borderColor: 'border-l-primary-300',
        textColor: 'text-primary-300',
    },
    'fintech-crypto': {
        borderColor: 'border-l-chart-period10',
        textColor: 'text-chart-period10',
    },
    'leveraged-etf': {
        borderColor: 'border-l-ui-warning',
        textColor: 'text-ui-warning',
    },
    'healthcare-bio': {
        borderColor: 'border-l-chart-rsi',
        textColor: 'text-chart-rsi',
    },
};

export function TickerCategories() {
    return (
        <nav
            aria-label="카테고리별 종목 탐색"
            className="px-6 py-14 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                카테고리별 종목
            </h2>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TICKER_CATEGORIES.map(category => {
                    const style = CATEGORY_STYLES[category.id];
                    return (
                        <div
                            key={category.id}
                            id={category.id}
                            className={cn(
                                'border-secondary-700 bg-secondary-800/50 scroll-mt-20 rounded-lg border p-5',
                                'border-l-2',
                                style.borderColor
                            )}
                        >
                            <h3
                                className={cn(
                                    'mb-3 text-xs font-semibold tracking-wider uppercase',
                                    style.textColor
                                )}
                            >
                                {category.label}
                            </h3>
                            <ul
                                className="flex [touch-action:manipulation] flex-wrap gap-2"
                                aria-label={`${category.label} 종목 목록`}
                            >
                                {category.tickers.map(ticker => (
                                    <li key={ticker}>
                                        <Link
                                            href={`/${ticker}`}
                                            title={`${ticker} 주식 분석`}
                                            className="border-secondary-700 text-secondary-300 hover:border-primary-600/40 hover:text-primary-400 focus-visible:ring-primary-500 inline-block rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                        >
                                            {ticker}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}
