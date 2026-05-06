/**
 * @jest-environment jsdom
 *
 * jsdom-level coverage for ChatPanel mobile-input regression risk
 * (PR #407 follow-up). These tests verify class composition, ref
 * wiring, and event handler attachment — they CANNOT verify actual
 * iOS Safari layout/visibility, which still requires manual testing
 * on a real device or simulator.
 */

import { ChatPanel } from '@/components/chat/ChatPanel';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@/components/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

jest.mock('@/components/chat/hooks/useChat', () => ({
    useChat: () => ({
        messages: [],
        loadingPhase: null,
        analysisUpdated: false,
        remainingTokens: null,
        sendMessage: jest.fn(),
        dismissAnalysisUpdated: jest.fn(),
        selectedModel: 'gemini-2.5-flash',
        handleModelChange: jest.fn(),
        gateModal: null,
        dismissGate: jest.fn(),
    }),
}));

let mockIsAnalysisReady = true;
jest.mock('@/components/chat/hooks/useSymbolChat', () => ({
    useSymbolChat: () => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: mockIsAnalysisReady,
        publish: jest.fn(),
        clear: jest.fn(),
    }),
}));

function renderPanel(overrides: Partial<{ onClose: () => void }> = {}) {
    mockIsAnalysisReady = true;
    return render(<ChatPanel symbol="AAPL" onClose={overrides.onClose} />);
}

describe('ChatPanel', () => {
    // jsdom does not implement scrollIntoView; useChatInput calls it on
    // messagesEndRef in a useEffect. Scoped inside the describe block per
    // MISTAKES.md Tests rule 3.
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    beforeEach(() => {
        // 모듈 스코프 mock state는 테스트 간 순서 의존성을 만들 수 있으므로 명시적 초기화.
        mockIsAnalysisReady = true;
    });

    describe('PR #407 mobile-input regression guards', () => {
        it('outermost wrapper carries overflow-hidden + rounded-xl (the moved classes)', () => {
            const { container } = renderPanel();
            const root = container.firstElementChild;
            expect(root).not.toBeNull();
            expect(root!.className).toContain('overflow-hidden');
            expect(root!.className).toContain('rounded-xl');
            expect(root!.className).toContain('flex');
            expect(root!.className).toContain('flex-col');
        });

        it('textarea input is rendered, not disabled when analysis ready, and accepts mobile typing hints', () => {
            renderPanel();
            const textarea = screen.getByPlaceholderText(
                /질문을 입력하세요/
            ) as HTMLTextAreaElement;
            expect(textarea).toBeInTheDocument();
            expect(textarea).not.toBeDisabled();
            // enterKeyHint helps mobile keyboards show "send" instead of "return"
            expect(textarea).toHaveAttribute('enterkeyhint', 'send');
            expect(textarea).toHaveAttribute('autocapitalize', 'sentences');
            expect(textarea).toHaveAttribute('autocorrect', 'on');
        });

        it('textarea has min-h-[44px] for iOS tap-target compliance on mobile', () => {
            renderPanel();
            const textarea = screen.getByPlaceholderText(
                /질문을 입력하세요/
            ) as HTMLTextAreaElement;
            expect(textarea.className).toContain('min-h-11');
        });

        it('send button meets 44px minimum tap target on mobile (md:h-8 only on desktop)', () => {
            renderPanel();
            const send = screen.getByRole('button', { name: '전송' });
            expect(send.className).toContain('h-11');
            expect(send.className).toContain('w-11');
            expect(send.className).toContain('md:h-8');
            expect(send.className).toContain('md:w-8');
        });

        it('close button (when onClose provided) meets 44px minimum tap target on mobile', () => {
            renderPanel({ onClose: jest.fn() });
            const close = screen.getByRole('button', { name: '채팅 닫기' });
            expect(close.className).toContain('h-11');
            expect(close.className).toContain('w-11');
        });

        it('close button is omitted when onClose is not provided', () => {
            renderPanel();
            expect(
                screen.queryByRole('button', { name: '채팅 닫기' })
            ).not.toBeInTheDocument();
        });

        it('placeholder reflects ready/not-ready state', () => {
            mockIsAnalysisReady = false;
            const { rerender } = render(<ChatPanel symbol="AAPL" />);
            expect(
                screen.getByPlaceholderText(/분석이 완료된 후/)
            ).toBeInTheDocument();

            mockIsAnalysisReady = true;
            rerender(<ChatPanel symbol="AAPL" />);
            expect(
                screen.getByPlaceholderText(/질문을 입력하세요/)
            ).toBeInTheDocument();
        });

        it('input is disabled when analysis is not ready (prevents stuck typing on mobile)', () => {
            mockIsAnalysisReady = false;
            render(<ChatPanel symbol="AAPL" />);
            const textarea = screen.getByPlaceholderText(
                /분석이 완료된 후/
            ) as HTMLTextAreaElement;
            expect(textarea).toBeDisabled();
        });
    });
});
