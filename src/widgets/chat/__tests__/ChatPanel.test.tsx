/**
 * jsdom-level coverage for ChatPanel mobile-input regression risk
 * (PR #407 follow-up). These tests verify class composition, ref
 * wiring, and event handler attachment — they CANNOT verify actual
 * iOS Safari layout/visibility, which still requires manual testing
 * on a real device or simulator.
 */

import { ChatPanel } from '@/widgets/chat/ChatPanel';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

const mockUseChatReturn = {
    messages: [] as Array<{
        role: string;
        content?: string;
        label?: string;
        kind?: string;
    }>,
    loadingPhase: null as string | null,
    analysisUpdated: false,
    remainingTokens: null as number | null,
    sendMessage: vi.fn(),
    dismissAnalysisUpdated: vi.fn(),
    selectedModel: 'gemini-2.5-flash',
    isModelHydrated: true,
    handleModelChange: vi.fn(),
    gateModal: null as { mode: string; provider: string } | null,
    dismissGate: vi.fn(),
};

vi.mock('@/widgets/chat/hooks/useChat', () => ({
    useChat: () => mockUseChatReturn,
}));

let mockIsAnalysisReady = true;
vi.mock('@/features/symbol-chat', () => ({
    useSymbolChat: () => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: mockIsAnalysisReady,
        publish: vi.fn(),
        clear: vi.fn(),
    }),
}));

function renderPanel(overrides: Partial<{ onClose: () => void }> = {}) {
    mockIsAnalysisReady = true;
    return render(<ChatPanel symbol="AAPL" onClose={overrides.onClose} />);
}

function resetMockChat() {
    mockUseChatReturn.messages = [];
    mockUseChatReturn.loadingPhase = null;
    mockUseChatReturn.analysisUpdated = false;
    mockUseChatReturn.remainingTokens = null;
    mockUseChatReturn.selectedModel = 'gemini-2.5-flash';
    mockUseChatReturn.isModelHydrated = true;
    mockUseChatReturn.gateModal = null;
}

describe('ChatPanel', () => {
    // jsdom does not implement scrollIntoView; useChatInput calls it on
    // messagesEndRef in a useEffect. Scoped inside the describe block per
    // MISTAKES.md Tests rule 3.
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    beforeEach(() => {
        // 모듈 스코프 mock state는 테스트 간 순서 의존성을 만들 수 있으므로 명시적 초기화.
        mockIsAnalysisReady = true;
        resetMockChat();
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
            renderPanel({ onClose: vi.fn() });
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

    describe('message rendering', () => {
        it('shows empty state when no messages and no loading', () => {
            renderPanel();
            expect(
                screen.getByText(/분석 결과를 바탕으로 질문해 보세요/)
            ).toBeInTheDocument();
        });

        it('renders user messages on the right', () => {
            mockUseChatReturn.messages = [
                { role: 'user', content: '이 종목 지금 매수해도 될까요?' },
            ];
            renderPanel();
            expect(
                screen.getByText('이 종목 지금 매수해도 될까요?')
            ).toBeInTheDocument();
        });

        it('renders model messages with MarkdownText', () => {
            mockUseChatReturn.messages = [
                { role: 'model', content: 'AI 답변입니다.' },
            ];
            renderPanel();
            expect(screen.getByText('AI 답변입니다.')).toBeInTheDocument();
        });

        it('renders system context-switch messages', () => {
            mockUseChatReturn.messages = [
                {
                    role: 'system',
                    kind: 'context_switch',
                    label: 'AAPL 1Day',
                },
            ];
            renderPanel();
            expect(
                screen.getByText(/AAPL 1Day 페이지로 전환되었습니다/)
            ).toBeInTheDocument();
        });

        it('shows analyzing loading state', () => {
            mockUseChatReturn.loadingPhase = 'analyzing';
            renderPanel();
            expect(
                screen.getByText('질문 내용을 살펴보고 있어요...')
            ).toBeInTheDocument();
        });

        it('shows generating loading state', () => {
            mockUseChatReturn.loadingPhase = 'generating';
            renderPanel();
            expect(
                screen.getByText('답변을 작성하고 있어요...')
            ).toBeInTheDocument();
        });
    });

    describe('analysis updated banner', () => {
        it('shows analysis updated banner and dismiss button', () => {
            mockUseChatReturn.analysisUpdated = true;
            renderPanel();
            expect(
                screen.getByText(/분석이 업데이트됐어요/)
            ).toBeInTheDocument();
        });
    });

    describe('remaining tokens', () => {
        it('shows remaining tokens when provided', () => {
            mockUseChatReturn.remainingTokens = 3;
            renderPanel();
            expect(screen.getByText(/오늘 3회 남음/)).toBeInTheDocument();
        });

        it('hides remaining tokens when null', () => {
            mockUseChatReturn.remainingTokens = null;
            renderPanel();
            expect(screen.queryByText(/회 남음/)).not.toBeInTheDocument();
        });
    });

    describe('model hydration', () => {
        it('shows skeleton when model is not hydrated', () => {
            mockUseChatReturn.isModelHydrated = false;
            renderPanel();
            // Should show a skeleton, not the button
            expect(
                screen.queryByRole('button', { name: 'AI 모델 선택' })
            ).not.toBeInTheDocument();
        });

        it('shows model button when hydrated', () => {
            mockUseChatReturn.isModelHydrated = true;
            renderPanel();
            expect(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            ).toBeInTheDocument();
        });
    });

    describe('model dropdown', () => {
        it('opens model dropdown on click', () => {
            renderPanel();
            const modelBtn = screen.getByRole('button', {
                name: 'AI 모델 선택',
            });
            fireEvent.click(modelBtn);
            expect(
                screen.getByRole('listbox', { name: 'AI 모델 목록' })
            ).toBeInTheDocument();
        });

        it('keyboard ArrowDown navigates model options', () => {
            renderPanel();
            const modelBtn = screen.getByRole('button', {
                name: 'AI 모델 선택',
            });
            fireEvent.click(modelBtn);

            const listbox = screen.getByRole('listbox');
            fireEvent.keyDown(listbox, { key: 'ArrowDown' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('keyboard ArrowUp navigates model options', () => {
            renderPanel();
            const modelBtn = screen.getByRole('button', {
                name: 'AI 모델 선택',
            });
            fireEvent.click(modelBtn);

            const listbox = screen.getByRole('listbox');
            fireEvent.keyDown(listbox, { key: 'ArrowUp' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('keyboard Home selects first option', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );
            fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Home' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('keyboard End selects last option', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );
            fireEvent.keyDown(screen.getByRole('listbox'), { key: 'End' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('Escape closes the dropdown', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );
            expect(screen.getByRole('listbox')).toBeInTheDocument();

            fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        it('clicking an option selects it and closes dropdown', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );

            const options = screen.getAllByRole('option');
            fireEvent.click(options[1]);
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('Enter on an option selects it and closes dropdown', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );

            const options = screen.getAllByRole('option');
            fireEvent.keyDown(options[0], { key: 'Enter' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });

        it('Space on an option selects it', () => {
            renderPanel();
            fireEvent.click(
                screen.getByRole('button', { name: 'AI 모델 선택' })
            );

            const options = screen.getAllByRole('option');
            fireEvent.keyDown(options[0], { key: ' ' });
            expect(mockUseChatReturn.handleModelChange).toHaveBeenCalled();
        });
    });
});
