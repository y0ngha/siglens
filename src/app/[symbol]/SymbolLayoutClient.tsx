'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useBodyScrollLock } from '@/components/hooks/useBodyScrollLock';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/components/chat/SymbolChatContext';
import { useSymbolChat } from '@/components/chat/hooks/useSymbolChat';
import { SymbolLayoutHeader } from '@/components/symbol-page/SymbolLayoutHeader';
import { CHAT_NON_CHART_BASELINE_ANALYSIS } from '@/domain/chat/fallbackAnalysis';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';

interface SymbolLayoutClientProps {
    symbol: string;
    children: ReactNode;
}

/**
 * Client shell for `/[symbol]/*`. Hosts the page-agnostic header (breadcrumb +
 * SymbolTabs), the floating chat button, and the chat context — all of which need
 * to survive navigation between the 4 symbol pages.
 *
 * - The chart page wraps itself in a 100dvh container; non-chart pages need the body
 *   to scroll normally, so `useBodyScrollLock` only activates on `/{symbol}` (chart
 *   route).
 * - `FloatingChatButton` reads chart state from `SymbolChatContext`. ChartContent
 *   publishes via `usePublishSymbolChat`; on non-chart routes the chat falls back
 *   to a placeholder analysis with `isAnalysisReady=false`, which disables the input
 *   and surfaces the "분석 완료 후 질문 가능" placeholder.
 */
export function SymbolLayoutClient({
    symbol,
    children,
}: SymbolLayoutClientProps) {
    return (
        <SymbolChatProvider>
            <ChartScrollLockGate symbol={symbol} />
            <SymbolLayoutHeader symbol={symbol} />
            {children}
            <SymbolChatLauncher symbol={symbol} />
        </SymbolChatProvider>
    );
}

interface ChartScrollLockGateProps {
    symbol: string;
}

function ChartScrollLockGate({ symbol }: ChartScrollLockGateProps) {
    const pathname = usePathname();
    const ticker = symbol.toUpperCase();
    const isChartPage = pathname === `/${ticker}` || pathname === `/${symbol}`;
    if (!isChartPage) return null;
    return <ChartScrollLockEffect />;
}

function ChartScrollLockEffect() {
    useBodyScrollLock();
    return null;
}

interface SymbolChatLauncherProps {
    symbol: string;
}

function SymbolChatLauncher({ symbol }: SymbolChatLauncherProps) {
    const { context, timeframe, isAnalysisReady } = useSymbolChat();
    // Core's `buildChatPrompt` requires `analysis: AnalysisResponse` and
    // unconditionally embeds it as the primary "=== ANALYSIS DATA ===" block in
    // the system prompt (trend, summary, key levels, indicators, etc.) — even
    // when `currentAnalysisContext` is also provided. We cannot suppress that
    // block from the siglens side without a core API change.
    //
    // On the chart page, `context.payload` is the real technical analysis, so
    // the embedded block is correct. On non-chart pages (fundamental / news /
    // overall), pass `CHAT_NON_CHART_BASELINE_ANALYSIS` whose `summary` field
    // explicitly redirects the LLM to the `## Current analysis context` section
    // populated from `currentAnalysisContext`. This minimizes prompt pollution
    // until core's API is updated to make `analysis` optional. See the
    // TODO(siglens-core) note in `@/domain/chat/fallbackAnalysis`.
    const analysis =
        context !== null && context.kind === 'technical'
            ? context.payload
            : CHAT_NON_CHART_BASELINE_ANALYSIS;
    return (
        <FloatingChatButton
            symbol={symbol}
            timeframe={timeframe ?? DEFAULT_TIMEFRAME}
            analysis={analysis}
            currentAnalysisContext={context}
            isAnalysisReady={isAnalysisReady}
        />
    );
}
