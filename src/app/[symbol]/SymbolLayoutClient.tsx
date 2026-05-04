'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useBodyScrollLock } from '@/components/hooks/useBodyScrollLock';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/components/chat/SymbolChatContext';
import { SymbolLayoutHeader } from '@/components/symbol-page/SymbolLayoutHeader';

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
 * - `FloatingChatButton` reads its state from `SymbolChatContext` directly via
 *   `useChat`/`useSymbolChat` — no props drilling. Each page (chart/fundamental/
 *   news/overall) publishes its own analysis via `usePublishSymbolChat`.
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
            <FloatingChatButton symbol={symbol} />
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
