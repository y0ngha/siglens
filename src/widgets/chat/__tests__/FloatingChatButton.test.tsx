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

    it('renders ChatPanel when isOpen is true', async () => {
        vi.mocked(useChatButtonState).mockReturnValue({
            isOpen: true,
            showTooltip: false,
            handleClose: vi.fn(),
            handleButtonClick: vi.fn(),
            dismissTooltip: vi.fn(),
        });

        render(<FloatingChatButton symbol="AAPL" />);

        // 패널은 열었을 때만 내려받는 lazy 청크라 한 틱 뒤에 도착한다 —
        // 그 사이에는 "채팅을 여는 중…" 자리표가 껍데기 안에 렌더된다.
        expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
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
