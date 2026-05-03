'use client';

import Link from 'next/link';
import { useDefaultModelId } from '@/components/symbol-page/hooks/useDefaultModelId';
import { useNewsAugment } from '@/components/symbol-page/hooks/useNewsAugment';

interface NewsAugmentProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
}

// Shares cache with the news page — resolves immediately if the user visited news first.
export function NewsAugment({ symbol }: NewsAugmentProps) {
    const modelId = useDefaultModelId();
    const result = useNewsAugment(symbol, modelId);

    if (result === null) return null;

    return (
        <aside className="border-secondary-700 mt-4 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">뉴스 자료 종합</h3>
            <p className="text-secondary-400 mt-2 text-sm">
                {result.currentDriverKo}
            </p>
            <Link
                href={`/${symbol}/news`}
                className="text-primary-400 focus-visible:ring-primary-500 mt-3 inline-block rounded-sm text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                <span aria-hidden="true">→ </span>더 자세한 뉴스 분석 보기
            </Link>
        </aside>
    );
}
