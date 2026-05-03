'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { DEFAULT_TIER, getAllowedModels } from '@y0ngha/siglens-core';
import { resolveDefaultModelForProvider } from '@/domain/llm/providerDefaults';
import { useSelectedProvider } from '@/components/symbol-page/hooks/useSelectedProvider';
import { useNewsAugment } from '@/components/symbol-page/hooks/useNewsAugment';

interface NewsAugmentProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
}

/**
 * A2+A3 chart page news augment.
 *
 * Shows the "current driver" paragraph from the News analysis result.
 * The analysis result is shared with the `/[symbol]/news` page via cache —
 * if the user visited the News page first, this resolves immediately.
 *
 * Returns `null` while loading, on error, or when there is no recent news.
 * The chart page layout is not disrupted by missing news data.
 */
export function NewsAugment({ symbol }: NewsAugmentProps) {
    const [selectedProvider] = useSelectedProvider();
    const allowedModels = useMemo(() => getAllowedModels(DEFAULT_TIER), []);
    const modelId = useMemo(
        () =>
            resolveDefaultModelForProvider(selectedProvider, allowedModels) ??
            'claude-haiku-3-5',
        [selectedProvider, allowedModels]
    );

    const state = useNewsAugment(symbol, modelId);

    if (state.status !== 'done') return null;

    return (
        <aside className="mt-4 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">뉴스 자료 종합</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                {state.result.currentDriverKo}
            </p>
            <Link
                href={`/${symbol}/news`}
                className="mt-3 inline-block rounded-sm text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                <span aria-hidden="true">→ </span>더 자세한 뉴스 분석 보기
            </Link>
        </aside>
    );
}
