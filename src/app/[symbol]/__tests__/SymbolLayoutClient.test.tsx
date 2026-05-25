vi.mock('@/widgets/chat/FloatingChatButton', () => ({
    FloatingChatButton: ({ symbol }: { symbol: string }) => (
        <button data-testid="chat-button">{symbol}</button>
    ),
}));
vi.mock('@/features/symbol-chat', () => ({
    SymbolChatProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="chat-provider">{children}</div>
    ),
}));
vi.mock('@/widgets/symbol-page/SymbolModelContext', () => ({
    SymbolModelProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="model-provider">{children}</div>
    ),
}));

import { render, screen } from '@testing-library/react';
import {
    SymbolLayoutProviders,
    SymbolLayoutFloatingChat,
} from '@/app/[symbol]/SymbolLayoutClient';

describe('SymbolLayoutProviders', () => {
    it('renders children inside SymbolChatProvider and SymbolModelProvider', () => {
        render(
            <SymbolLayoutProviders>
                <div data-testid="child">content</div>
            </SymbolLayoutProviders>
        );

        expect(screen.getByTestId('chat-provider')).toBeInTheDocument();
        expect(screen.getByTestId('model-provider')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});

describe('SymbolLayoutFloatingChat', () => {
    it('renders FloatingChatButton with the given symbol', () => {
        render(<SymbolLayoutFloatingChat symbol="AAPL" />);

        expect(screen.getByTestId('chat-button')).toHaveTextContent('AAPL');
    });
});
