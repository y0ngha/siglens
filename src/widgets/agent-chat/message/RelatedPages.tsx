'use client';

/**
 * 답 아래의 "siglens에서 보기" 링크 — 에이전트가 실제로 조회한 종목 페이지로 돌아가는 길.
 */
import { useTranslations } from 'next-intl';
import type { RelatedSymbolPage } from '@/features/agent-chat/lib/relatedSymbolPages';
import { cn } from '@/shared/lib/cn';
import { ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';
import { AI_RAISED_CONTROL } from '../aiSurfaceStyles';

interface RelatedPagesProps {
    readonly pages: RelatedSymbolPage[];
    /** 대화 전체에서 한 번에 받은 표시 이름(`MessageList`의 `useSymbolLabels`). */
    readonly labels: Readonly<Record<string, string>>;
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/**
 * The way back to siglens.io from an answer: the symbol pages the agent read,
 * as quiet links under the text. A hook, not a banner — it only appears when
 * the answer was about a symbol, and only for symbols actually looked up.
 */
export function RelatedPages({
    pages,
    labels,
    siteUrl,
    localePrefix,
}: RelatedPagesProps) {
    const t = useTranslations('widgets.agent-chat');
    if (pages.length === 0) return null;
    return (
        <nav
            aria-label={t('MessageList.relatedPages')}
            className="mt-4 flex flex-wrap items-center gap-1.5"
        >
            {pages.map(page => (
                <a
                    key={page.symbol}
                    href={`${siteUrl}${localePrefix}/${encodeURIComponent(page.symbol)}${page.tab ? `/${page.tab}` : ''}`}
                    className={cn(
                        AI_RAISED_CONTROL,
                        'inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs text-secondary-300 hover:text-primary-400'
                    )}
                >
                    {t('MessageList.openOnSiglens', {
                        symbol: labels[page.symbol] ?? page.symbol,
                    })}
                    <ArrowUpRightIcon className="size-3" />
                </a>
            ))}
        </nav>
    );
}
