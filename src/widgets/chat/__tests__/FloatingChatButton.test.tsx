vi.mock('@/features/symbol-chat', () => ({
    useSymbolChat: vi.fn(() => ({ isAnalysisReady: false })),
}));
vi.mock('../hooks/useChatButtonState', () => ({
    useChatButtonState: vi.fn(() => ({
        isOpen: false,
        showTooltip: false,
        handleClose: vi.fn(),
        handleButtonClick: vi.fn(),
        dismissTooltip: vi.fn(),
    })),
}));
vi.mock('../ChatPanel', () => ({
    ChatPanel: () => <div data-testid="chat-panel" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { FloatingChatButton } from '../FloatingChatButton';
import { useChatButtonState } from '../hooks/useChatButtonState';

describe('FloatingChatButton', () => {
    it('renders the toggle button with "AI 채팅 열기" label when closed', () => {
        render(<FloatingChatButton symbol="AAPL" />);

        expect(
            screen.getByRole('button', { name: /AI 채팅 열기/ })
        ).toBeInTheDocument();
    });

    it('renders ChatPanel when isOpen is true', () => {
        vi.mocked(useChatButtonState).mockReturnValue({
            isOpen: true,
            showTooltip: false,
            handleClose: vi.fn(),
            handleButtonClick: vi.fn(),
            dismissTooltip: vi.fn(),
        });

        render(<FloatingChatButton symbol="AAPL" />);

        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /AI 채팅 닫기/ })
        ).toBeInTheDocument();
    });

    it('renders tooltip when showTooltip is true and panel is closed', () => {
        vi.mocked(useChatButtonState).mockReturnValue({
            isOpen: false,
            showTooltip: true,
            handleClose: vi.fn(),
            handleButtonClick: vi.fn(),
            dismissTooltip: vi.fn(),
        });

        render(<FloatingChatButton symbol="AAPL" />);

        expect(
            screen.getByText(/분석 내용에 궁금하신 게 있다면/)
        ).toBeInTheDocument();
    });

    it('calls handleButtonClick when the toggle button is clicked', () => {
        const handleButtonClick = vi.fn();
        vi.mocked(useChatButtonState).mockReturnValue({
            isOpen: false,
            showTooltip: false,
            handleClose: vi.fn(),
            handleButtonClick,
            dismissTooltip: vi.fn(),
        });

        render(<FloatingChatButton symbol="AAPL" />);
        fireEvent.click(screen.getByRole('button', { name: /AI 채팅 열기/ }));

        expect(handleButtonClick).toHaveBeenCalledTimes(1);
    });
});
