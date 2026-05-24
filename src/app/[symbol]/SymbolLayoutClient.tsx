'use client';

import { type ReactNode } from 'react';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/features/symbol-chat';
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
