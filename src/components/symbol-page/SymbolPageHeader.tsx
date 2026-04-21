'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import type { AssetInfo, Timeframe } from '@/domain/types';
import { TimeframeSelector } from '@/components/chart/TimeframeSelector';

interface SymbolPageHeaderProps {
    symbol: string;
    assetInfo: AssetInfo | undefined;
    timeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
}

export function SymbolPageHeader({
    symbol,
    assetInfo,
    timeframe,
    onTimeframeChange,
}: SymbolPageHeaderProps): ReactElement {
    const ticker = symbol.toUpperCase();
    const hasCompanyName = !!assetInfo && assetInfo.name !== ticker;

    return (
        <header className="border-secondary-700 border-b px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link
                        href="/"
                        className="text-secondary-500 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                    >
                        SIGLENS
                    </Link>
                    <span className="text-secondary-700">/</span>
                    <h1 className="text-secondary-100 text-lg font-semibold tracking-wide">
                        {assetInfo?.koreanName && (
                            <span className="text-secondary-300">
                                {assetInfo.koreanName}
                                {hasCompanyName ? ', ' : ' '}
                            </span>
                        )}
                        {assetInfo && hasCompanyName && (
                            <span className="text-secondary-200">
                                {assetInfo.name}{' '}
                            </span>
                        )}
                        ({ticker})<span className="sr-only"> 기술적 분석</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:block">
                        <TimeframeSelector
                            value={timeframe}
                            onChange={onTimeframeChange}
                        />
                    </div>
                </div>
            </div>
            <div className="mt-2 sm:hidden">
                <TimeframeSelector
                    value={timeframe}
                    onChange={onTimeframeChange}
                />
            </div>
        </header>
    );
}
