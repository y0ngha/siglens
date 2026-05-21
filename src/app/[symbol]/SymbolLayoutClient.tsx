'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useBodyScrollLock } from '@/components/hooks/useBodyScrollLock';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/components/chat/SymbolChatContext';
import { SymbolLayoutHeader } from '@/components/symbol-page/SymbolLayoutHeader';
import { SymbolModelProvider } from '@/components/symbol-page/SymbolModelContext';

interface SymbolLayoutProvidersProps {
    children: ReactNode;
}

/**
 * Client provider subtree shared by every `/[symbol]/*` page. Keeps the chat and
 * model contexts alive across symbol tab navigation so per-tab pages can publish
 * and consume chat state without remounting providers.
 */
export function SymbolLayoutProviders({
    children,
}: SymbolLayoutProvidersProps) {
    return (
        <SymbolChatProvider>
            <SymbolModelProvider>{children}</SymbolModelProvider>
        </SymbolChatProvider>
    );
}

interface SymbolLayoutHeaderClientProps {
    symbol: string;
}

/**
 * Client chrome for `/[symbol]/*`. Hosts the page-agnostic header (breadcrumb +
 * SymbolTabs) and chart-route scroll lock.
 *
 * The chart page wraps itself in a 100dvh container; non-chart pages need the body
 * to scroll normally, so `useBodyScrollLock` only activates on `/{symbol}` (chart
 * route).
 */
export function SymbolLayoutHeaderClient({
    symbol,
}: SymbolLayoutHeaderClientProps) {
    return (
        <>
            <ChartScrollLockGate symbol={symbol} />
            <SymbolLayoutHeader symbol={symbol} />
        </>
    );
}

interface SymbolLayoutFloatingChatProps {
    symbol: string;
}

/**
 * Floating chat launcher. Reads chat state from `SymbolChatContext` via
 * `useChat`/`useSymbolChat` — no props drilling. Each page (chart/fundamental/
 * news/overall) publishes its own analysis via `usePublishSymbolChat`.
 *
 * Mounted after the active page subtree so the launcher's tab order follows the
 * page content (assistive tech reaches the page first, then the chat affordance).
 */
export function SymbolLayoutFloatingChat({
    symbol,
}: SymbolLayoutFloatingChatProps) {
    return <FloatingChatButton symbol={symbol} />;
}

interface ChartScrollLockGateProps {
    symbol: string;
}

function ChartScrollLockGate({ symbol }: ChartScrollLockGateProps) {
    const pathname = usePathname();
    const ticker = symbol.toUpperCase();
    // Match both upper- and lower-case URL forms so direct hits like `/aapl` (Next.js
    // does not auto-canonicalize ticker case) still receive the chart-only scroll lock.
    const isChartPage = pathname === `/${ticker}` || pathname === `/${symbol}`;
    if (!isChartPage) return null;
    return <ChartScrollLockEffect />;
}

function ChartScrollLockEffect() {
    useBodyScrollLock();
    return null;
}
